import { v4 as uuid } from 'uuid';
import type { Socket, Server as IOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@alias/shared';
import { store } from '../store.js';
import { createRoom, generateRoomCode, toRoomView, makeTeam, MAX_TEAMS } from '../roomUtils.js';
import {
  startTurn, resolveWord, endTurn, applyTurnScore,
  advanceTurn, currentWordIndex, deckStore, getDescriber,
} from '../gameEngine.js';
import type { GameRoom } from '@alias/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

/** Active turn timers keyed by roomId */
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Steal-vote window timers keyed by roomId */
const stealVoteTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function broadcastRoom(io: IO, room: GameRoom) {
  io.to(room.roomId).emit('room:state', toRoomView(room));
}

function sendWordToDescriber(io: IO, room: GameRoom) {
  const turn = room.currentTurn;
  if (!turn || turn.status !== 'active') return;

  const idx = currentWordIndex(turn);
  if (idx === -1) {
    // No more words — end turn early
    finishTurn(io, room.roomId);
    return;
  }

  const word = turn.words[idx]!.word;
  const total = turn.words.length;

  // Emit only to the describer's socket
  const describerPlayer = room.players[turn.describerId];
  if (!describerPlayer) return;

  // Find the socket by scanning the socketIndex — we stored it on join
  // We emit to the room and rely on socket-level filtering via a room join trick:
  // the describer is in a private room: `describer:{socketId}` — see join handler
  io.to(`describer:${turn.describerId}`).emit('turn:your_word', {
    word,
    index: idx,
    total,
  });
}

function scheduleTurnEnd(io: IO, roomId: string, endsAt: number) {
  clearTurnTimer(roomId);
  const delay = Math.max(0, endsAt - Date.now());
  const timer = setTimeout(() => finishTurn(io, roomId), delay);
  turnTimers.set(roomId, timer);
}

function clearTurnTimer(roomId: string) {
  const t = turnTimers.get(roomId);
  if (t) { clearTimeout(t); turnTimers.delete(roomId); }
}

function finishTurn(io: IO, roomId: string) {
  clearTurnTimer(roomId);
  let room = store.getRoom(roomId);
  if (!room || !room.currentTurn) return;

  // If a word is still pending when time runs out, enter a 5-second steal-vote window
  const pendingIdx = currentWordIndex(room.currentTurn);
  if (pendingIdx !== -1 && room.currentTurn.status === 'active') {
    const STEAL_VOTE_MS = 5000;
    const stealVoteEndsAt = Date.now() + STEAL_VOTE_MS;
    const turn = { ...room.currentTurn, status: 'steal_vote' as const, endsAt: stealVoteEndsAt };
    room = { ...room, currentTurn: turn };
    store.setRoom(room);
    broadcastRoom(io, room);

    const timer = setTimeout(() => concludeStealVote(io, roomId), STEAL_VOTE_MS);
    stealVoteTimers.set(roomId, timer);
    return;
  }

  concludeReview(io, room);
}

function concludeStealVote(io: IO, roomId: string) {
  const t = stealVoteTimers.get(roomId);
  if (t) { clearTimeout(t); stealVoteTimers.delete(roomId); }

  const room = store.getRoom(roomId);
  if (!room || !room.currentTurn) return;
  // Only act if still in steal_vote (a steal may have already concluded it)
  if (room.currentTurn.status !== 'steal_vote') return;

  concludeReview(io, room);
}

function concludeReview(io: IO, room: GameRoom) {
  const finishedTurn = endTurn(room.currentTurn!);
  room = applyTurnScore({ ...room, currentTurn: finishedTurn }, finishedTurn);
  room = { ...room, currentTurn: finishedTurn, status: 'turn_review' };
  store.setRoom(room);
  broadcastRoom(io, room);
}

// ─── Connection handler ───────────────────────────────────────────────────────

export function registerHandlers(io: IO, socket: TypedSocket) {

  // ── room:create ─────────────────────────────────────────────────────────────
  socket.on('room:create', ({ playerName }, ack) => {
    const playerId = uuid();
    const roomId = uuid();
    let roomCode = generateRoomCode();
    // Collision guard (extremely rare but worth it)
    while (store.getRoomByCode(roomCode)) roomCode = generateRoomCode();

    const player = {
      playerId,
      name: playerName.trim().slice(0, 24),
      roomId,
      teamId: null,
      isHost: true,
      isConnected: true,
    };

    const room = createRoom(player, roomId, roomCode);
    store.setRoom(room);
    store.indexSocket(socket.id, roomId, playerId);

    socket.join(roomId);
    socket.join(`describer:${playerId}`);

    broadcastRoom(io, room);
    ack({ ok: true, data: { roomCode, playerId } });
  });

  // ── room:join ───────────────────────────────────────────────────────────────
  socket.on('room:join', ({ roomCode, playerName }, ack) => {
    const room = store.getRoomByCode(roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found.' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'Game already in progress.' });

    const playerId = uuid();
    const player = {
      playerId,
      name: playerName.trim().slice(0, 24),
      roomId: room.roomId,
      teamId: null,
      isHost: false,
      isConnected: true,
    };

    const updated: GameRoom = {
      ...room,
      players: { ...room.players, [playerId]: player },
    };
    store.setRoom(updated);
    store.indexSocket(socket.id, room.roomId, playerId);

    socket.join(room.roomId);
    socket.join(`describer:${playerId}`);

    broadcastRoom(io, updated);
    ack({ ok: true, data: { playerId } });
  });

  // ── room:rejoin ─────────────────────────────────────────────────────────────
  socket.on('room:rejoin', ({ playerId, roomCode }, ack) => {
    const room = store.getRoomByCode(roomCode);
    if (!room) return ack({ ok: false, error: 'Room not found.' });

    const player = room.players[playerId];
    if (!player) return ack({ ok: false, error: 'Player not found.' });

    // Re-index this socket to the player
    store.indexSocket(socket.id, room.roomId, playerId);
    socket.join(room.roomId);
    socket.join(`describer:${playerId}`);

    // Mark player as reconnected
    const updated = {
      ...room,
      players: { ...room.players, [playerId]: { ...player, isConnected: true } },
    };
    store.setRoom(updated);
    broadcastRoom(io, updated);

    ack({ ok: true, data: null });
  });

  // ── room:assign_team ────────────────────────────────────────────────────────
  socket.on('room:assign_team', ({ targetPlayerId, teamIndex }) => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    let room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId) return;
    if (teamIndex < 0 || teamIndex >= room.teams.length) return;

    // Remove player from any existing team
    const teams = room.teams.map(t => ({
      ...t,
      playerIds: t.playerIds.filter(id => id !== targetPlayerId),
    }));

    // Add to new team
    teams[teamIndex] = {
      ...teams[teamIndex]!,
      playerIds: [...teams[teamIndex]!.playerIds, targetPlayerId],
    };

    // Update player's teamId
    const player = room.players[targetPlayerId];
    if (!player) return;
    const players = {
      ...room.players,
      [targetPlayerId]: { ...player, teamId: teams[teamIndex]!.teamId },
    };

    store.setRoom({ ...room, teams, players });
    broadcastRoom(io, { ...room, teams, players });
  });

  // ── room:add_team ───────────────────────────────────────────────────────────
  socket.on('room:add_team', () => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    const room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId || room.status !== 'lobby') return;
    if (room.teams.length >= MAX_TEAMS) return;

    const updated: GameRoom = { ...room, teams: [...room.teams, makeTeam(room.teams.length)] };
    store.setRoom(updated);
    broadcastRoom(io, updated);
  });

  // ── room:remove_team ────────────────────────────────────────────────────────
  socket.on('room:remove_team', () => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    const room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId || room.status !== 'lobby') return;
    if (room.teams.length <= 2) return; // minimum 2 teams

    const lastTeam = room.teams[room.teams.length - 1]!;
    // Move any players from the removed team back to unassigned
    const players = { ...room.players };
    for (const pid of lastTeam.playerIds) {
      const p = players[pid];
      if (p) players[pid] = { ...p, teamId: null };
    }

    const updated: GameRoom = { ...room, teams: room.teams.slice(0, -1), players };
    store.setRoom(updated);
    broadcastRoom(io, updated);
  });

  // ── room:rename_team ────────────────────────────────────────────────────────
  socket.on('room:rename_team', ({ teamIndex, name }) => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    const room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId || room.status !== 'lobby') return;
    if (teamIndex < 0 || teamIndex >= room.teams.length) return;
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;

    const teams = room.teams.map((t, i) =>
      i === teamIndex ? { ...t, name: trimmed } : t,
    );
    const updated = { ...room, teams };
    store.setRoom(updated);
    broadcastRoom(io, updated);
  });

  // ── room:update_settings ────────────────────────────────────────────────────
  socket.on('room:update_settings', (partial) => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    let room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId) return;

    const settings = { ...room.settings, ...partial };
    settings.turnDurationSeconds = Math.min(Math.max(settings.turnDurationSeconds, 15), 180);
    settings.targetScore = Math.min(Math.max(settings.targetScore, 10), 80);

    const updated = { ...room, settings };
    store.setRoom(updated);
    broadcastRoom(io, updated);
  });

  // ── room:start ──────────────────────────────────────────────────────────────
  socket.on('room:start', (ack) => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return ack({ ok: false, error: 'Not in a room.' });
    const room = store.getRoom(ctx.roomId);
    if (!room) return ack({ ok: false, error: 'Room not found.' });
    if (room.hostId !== ctx.playerId) return ack({ ok: false, error: 'Only the host can start.' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'Game already started.' });

    const playersWithTeams = Object.values(room.players).filter(p => p.teamId !== null);
    const teamsWithPlayers = room.teams.filter(t => t.playerIds.length > 0);
    if (teamsWithPlayers.length < 2) return ack({ ok: false, error: 'Need at least 2 teams with players.' });
    if (playersWithTeams.length < 2) return ack({ ok: false, error: 'Need at least 2 players assigned to teams.' });

    deckStore.init(room.roomId);
    beginNextTurn(io, { ...room, status: 'turn_countdown' });
    ack({ ok: true, data: null });
  });

  // ── turn:guessed ────────────────────────────────────────────────────────────
  socket.on('turn:guessed', () => {
    handleWordOutcome(io, socket, 'guessed');
  });

  // ── turn:skipped ────────────────────────────────────────────────────────────
  socket.on('turn:skipped', () => {
    handleWordOutcome(io, socket, 'skipped');
  });

  // ── turn:steal ──────────────────────────────────────────────────────────────
  socket.on('turn:steal', () => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    let room = store.getRoom(ctx.roomId);
    if (!room || !room.currentTurn) return;
    const turnStatus = room.currentTurn.status;
    if (turnStatus !== 'active' && turnStatus !== 'steal_vote') return;

    // Must be on a different team than the active one
    const player = room.players[ctx.playerId];
    if (!player || !player.teamId) return;
    if (player.teamId === room.currentTurn.teamId) return;

    const stealingTeam = room.teams.find(t => t.teamId === player.teamId);
    if (!stealingTeam) return;

    const idx = currentWordIndex(room.currentTurn);
    if (idx === -1) return;

    const stolenWord = room.currentTurn.words[idx]!;
    const words = room.currentTurn.words.map((w, i) =>
      i === idx ? { ...w, status: 'stolen' as const, stolenByTeamId: stealingTeam.teamId } : w,
    );

    // Award +1 to stealing team immediately
    const teams = room.teams.map(t =>
      t.teamId === stealingTeam.teamId ? { ...t, score: t.score + 1 } : t,
    );

    const updatedTurn = { ...room.currentTurn, words };
    room = { ...room, teams, currentTurn: updatedTurn };
    store.setRoom(room);

    io.to(room.roomId).emit('turn:word_result', {
      word: stolenWord.word,
      status: 'stolen',
      scoreChange: 1,
      stolenByTeamName: stealingTeam.name,
    });

    if (turnStatus === 'steal_vote') {
      // Steal during vote window → immediately end the turn
      concludeStealVote(io, room.roomId);
    } else {
      broadcastRoom(io, room);
      sendWordToDescriber(io, room);
    }
  });

  // ── turn:confirm_review ─────────────────────────────────────────────────────
  socket.on('turn:confirm_review', () => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    let room = store.getRoom(ctx.roomId);
    if (!room || room.hostId !== ctx.playerId) return;
    if (room.status !== 'turn_review') return;

    room = advanceTurn(room);
    store.setRoom(room);

    if (room.status === 'game_over') {
      broadcastRoom(io, room);
    } else {
      beginNextTurn(io, room);
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const ctx = store.lookupSocket(socket.id);
    if (!ctx) return;
    store.removeSocket(socket.id);

    const room = store.getRoom(ctx.roomId);
    if (!room) return;

    const player = room.players[ctx.playerId];
    if (!player) return;

    const updated: GameRoom = {
      ...room,
      players: {
        ...room.players,
        [ctx.playerId]: { ...player, isConnected: false },
      },
    };
    store.setRoom(updated);
    broadcastRoom(io, updated);
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function beginNextTurn(io: IO, room: GameRoom) {
  const deck = deckStore.get(room.roomId);
  const { turn, remainingDeck, countdownEndsAt } = startTurn(room, deck);

  deckStore.set(room.roomId, remainingDeck);

  const updated: GameRoom = { ...room, status: 'turn_countdown', currentTurn: turn };
  store.setRoom(updated);
  broadcastRoom(io, updated);

  // After countdown, activate the turn
  setTimeout(() => {
    let r = store.getRoom(room.roomId);
    if (!r || r.currentTurn?.turnId !== turn.turnId) return;
    const activeTurn = { ...r.currentTurn!, status: 'active' as const };
    r = { ...r, status: 'turn_active', currentTurn: activeTurn };
    store.setRoom(r);
    broadcastRoom(io, r);
    sendWordToDescriber(io, r);
    scheduleTurnEnd(io, r.roomId, turn.endsAt);
  }, countdownEndsAt - Date.now());
}

function handleWordOutcome(io: IO, socket: TypedSocket, outcome: 'guessed' | 'skipped') {
  const ctx = store.lookupSocket(socket.id);
  if (!ctx) return;
  let room = store.getRoom(ctx.roomId);
  if (!room || !room.currentTurn) return;
  if (room.currentTurn.status !== 'active') return;
  if (room.currentTurn.describerId !== ctx.playerId) return;
  // Reject actions after the turn should have ended (clock drift / lag)
  if (Date.now() >= room.currentTurn.endsAt) return;

  const { updated: updatedTurn, scoreChange } = resolveWord(room.currentTurn, outcome);
  const wordEntry = room.currentTurn.words[currentWordIndex(room.currentTurn)];

  // Apply score delta immediately
  const teams = room.teams.map(t =>
    t.teamId === updatedTurn.teamId
      ? { ...t, score: Math.max(0, t.score + scoreChange) }
      : t,
  );

  room = { ...room, teams, currentTurn: updatedTurn };
  store.setRoom(room);
  broadcastRoom(io, room);

  if (wordEntry) {
    io.to(room.roomId).emit('turn:word_result', {
      word: wordEntry.word,
      status: outcome,
      scoreChange,
    });
  }

  sendWordToDescriber(io, room);
}
