// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type RoomStatus =
  | 'lobby'
  | 'turn_countdown'
  | 'turn_active'
  | 'turn_review'
  | 'game_over';

export type WordStatus = 'pending' | 'guessed' | 'skipped' | 'stolen';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Player {
  playerId: string;
  name: string;
  roomId: string;
  teamId: string | null;
  isHost: boolean;
  isConnected: boolean;
}

export interface Team {
  teamId: string;
  name: string;
  playerIds: string[];
  score: number;
  currentDescriberIndex: number;
}

export interface GameSettings {
  turnDurationSeconds: number;
  /** Board finish line — first team to reach this score wins */
  targetScore: number;
  skipPenalty: boolean;
}

export interface TurnWord {
  word: string;
  status: WordStatus;
  stolenByTeamId?: string;
  /** True when the word was auto-skipped by the timer (not manually skipped by the describer) */
  autoSkipped?: boolean;
}

export interface TurnState {
  turnId: string;
  teamId: string;
  describerId: string;
  status: 'countdown' | 'active' | 'steal_vote' | 'review' | 'ended';
  words: TurnWord[];
  endsAt: number;
  /** True when the active team started this turn on a steal cell — other teams may guess */
  isStealTurn: boolean;
}

export interface GameRoom {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  players: Record<string, Player>;
  teams: Team[];
  settings: GameSettings;
  round: number;
  currentTeamIndex: number;
  currentTurn: TurnState | null;
}

// ─── Derived / View Types ─────────────────────────────────────────────────────

export type RoomView = Omit<GameRoom, 'currentTurn'> & {
  currentTurn: Omit<TurnState, 'words' | 'status'> & {
    status: 'countdown' | 'active' | 'steal_vote' | 'review' | 'ended';
    words: TurnWord[] | null;
    wordCount: number;
    guessedCount: number;
    stolenCount: number;
    isStealTurn: boolean;
    /** The word being contested during the steal-vote window (visible to all) */
    stealVoteWord?: string;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the set of board positions (1-based scores) that are "steal cells".
 * Deterministic from targetScore — safe to call on both server and client.
 * Distributes ~4 steal cells evenly across the track, avoiding start/finish.
 */
export function getStealPositions(targetScore: number): Set<number> {
  const positions = new Set<number>();
  const interval = Math.max(4, Math.floor(targetScore / 5));
  for (let pos = interval; pos < targetScore; pos += interval) {
    positions.add(pos);
  }
  return positions;
}
