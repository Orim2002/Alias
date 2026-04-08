import { v4 as uuid } from 'uuid';
import type { GameRoom, GameSettings, Player, RoomView, Team } from '@alias/shared';

const ADJECTIVES = ['WOLF', 'SWIFT', 'BOLD', 'CALM', 'DARK', 'FAST', 'GOLD', 'IRON', 'KEEN', 'LUSH'];

export function generateRoomCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}-${num}`;
}

export const DEFAULT_SETTINGS: GameSettings = {
  turnDurationSeconds: 60,
  targetScore: 40,
  skipPenalty: false,
};

export const TEAM_NAMES = ['קבוצה אדומה', 'קבוצה כחולה', 'קבוצה ירוקה', 'קבוצה צהובה', 'קבוצה סגולה', 'קבוצה תכולה'];
export const MAX_TEAMS = 6;

export function createRoom(hostPlayer: Player, roomId: string, roomCode: string): GameRoom {
  return {
    roomId,
    roomCode,
    hostId: hostPlayer.playerId,
    status: 'lobby',
    players: { [hostPlayer.playerId]: hostPlayer },
    teams: [makeTeam(0), makeTeam(1)],
    settings: { ...DEFAULT_SETTINGS },
    round: 1,
    currentTeamIndex: 0,
    currentTurn: null,
  };
}

export function makeTeam(index: number): Team {
  return {
    teamId: uuid(),
    name: TEAM_NAMES[index] ?? `Team ${index + 1}`,
    playerIds: [],
    score: 0,
    currentDescriberIndex: 0,
  };
}

/**
 * Produces a RoomView safe to broadcast to all clients.
 * - Strips the full word list from active turns (words only shown during review).
 * - Does NOT include the current word — that is sent separately to the describer.
 */
export function toRoomView(room: GameRoom): RoomView {
  let currentTurn: RoomView['currentTurn'] = null;

  if (room.currentTurn) {
    const t = room.currentTurn;
    const guessedCount = t.words.filter(w => w.status === 'guessed').length;
    const showWords = t.status === 'review' || t.status === 'ended';

    const stolenCount = t.words.filter(w => w.status === 'stolen').length;

    // During the steal-vote window, reveal the contested word to all clients
    const stealVoteWord = t.status === 'steal_vote'
      ? t.words.find(w => w.status === 'pending')?.word
      : undefined;

    currentTurn = {
      turnId: t.turnId,
      teamId: t.teamId,
      describerId: t.describerId,
      status: t.status,
      endsAt: t.endsAt,
      isStealTurn: t.isStealTurn,
      words: showWords ? t.words : null,
      wordCount: t.words.length,
      guessedCount,
      stolenCount,
      stealVoteWord,
    };
  }

  return { ...room, currentTurn };
}
