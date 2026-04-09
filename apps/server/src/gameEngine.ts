import { v4 as uuid } from 'uuid';
import type { GameRoom, TurnState, TurnWord } from '@alias/shared';
import { getStealPositions } from '@alias/shared';
import { shuffleDeck, WORD_LIST } from './words.js';

const COUNTDOWN_MS = 3000;
const WORDS_PER_TURN = 50; // draw enough that they never run out in one turn

// ─── Turn lifecycle ───────────────────────────────────────────────────────────

export function getDescriber(room: GameRoom): string | null {
  const team = room.teams[room.currentTeamIndex];
  if (!team || team.playerIds.length === 0) return null;
  const idx = team.currentDescriberIndex % team.playerIds.length;
  return team.playerIds[idx] ?? null;
}

export function startTurn(room: GameRoom, deck: string[]): {
  turn: TurnState;
  remainingDeck: string[];
  countdownEndsAt: number;
} {
  const describerId = getDescriber(room)!;
  const drawn = deck.slice(0, WORDS_PER_TURN);
  const remainingDeck = deck.slice(WORDS_PER_TURN);

  const countdownEndsAt = Date.now() + COUNTDOWN_MS;
  const endsAt = countdownEndsAt + room.settings.turnDurationSeconds * 1000;

  const stealPositions = getStealPositions(room.settings.targetScore);
  const currentTeamScore = room.teams[room.currentTeamIndex]!.score;

  const turn: TurnState = {
    turnId: uuid(),
    teamId: room.teams[room.currentTeamIndex]!.teamId,
    describerId,
    status: 'countdown',
    words: drawn.map(w => ({ word: w, status: 'pending' })),
    endsAt,
    isStealTurn: stealPositions.has(currentTeamScore),
  };

  return { turn, remainingDeck, countdownEndsAt };
}

/** Returns the index of the first pending word, or -1 if none remain */
export function currentWordIndex(turn: TurnState): number {
  return turn.words.findIndex(w => w.status === 'pending');
}

export function resolveWord(
  turn: TurnState,
  outcome: 'guessed' | 'skipped',
): { updated: TurnState; scoreChange: number } {
  const idx = currentWordIndex(turn);
  if (idx === -1) return { updated: turn, scoreChange: 0 };

  const words: TurnWord[] = turn.words.map((w, i) =>
    i === idx ? { ...w, status: outcome } : w,
  );

  const scoreChange = outcome === 'guessed' ? 1 : -1;

  return { updated: { ...turn, words }, scoreChange };
}

/** Called when the turn timer fires or all words are exhausted */
export function endTurn(turn: TurnState): TurnState {
  const words: TurnWord[] = turn.words.map(w =>
    w.status === 'pending' ? { ...w, status: 'skipped', autoSkipped: true } : w,
  );
  return { ...turn, status: 'review', words };
}

// ─── Score + rotation ─────────────────────────────────────────────────────────

/**
 * All scoring is applied live during the turn (guessed +1, manual-skip -1, stolen +1).
 * Words that were never reached when the timer fired are NOT penalized.
 */
export function applyTurnScore(room: GameRoom, _turn: TurnState): GameRoom {
  return room;
}

export function advanceTurn(room: GameRoom): GameRoom {
  // Rotate describer within current team
  const teams = room.teams.map((t, i) =>
    i === room.currentTeamIndex
      ? { ...t, currentDescriberIndex: t.currentDescriberIndex + 1 }
      : t,
  );

  // Check if any team has reached the finish line
  const anyTeamWon = teams.some(t => t.score >= room.settings.targetScore);

  const nextTeamIndex = (room.currentTeamIndex + 1) % room.teams.length;
  const nextRound = nextTeamIndex === 0 ? room.round + 1 : room.round;

  return {
    ...room,
    teams,
    currentTeamIndex: nextTeamIndex,
    round: nextRound,
    status: anyTeamWon ? 'game_over' : room.status,
    currentTurn: null,
  };
}

// ─── Deck management ─────────────────────────────────────────────────────────

/** Stored separately from GameRoom to avoid sending it to clients */
const decks = new Map<string, string[]>();

export const deckStore = {
  init(roomId: string): void {
    decks.set(roomId, shuffleDeck(WORD_LIST));
  },
  get(roomId: string): string[] {
    return decks.get(roomId) ?? [];
  },
  set(roomId: string, deck: string[]): void {
    decks.set(roomId, deck);
  },
  delete(roomId: string): void {
    decks.delete(roomId);
  },
};
