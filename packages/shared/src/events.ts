import type { RoomView, GameSettings } from './types.js';

// ─── Client → Server ──────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  'room:create': (payload: { playerName: string }, ack: (res: AckResponse<{ roomCode: string; playerId: string }>) => void) => void;
  'room:join': (payload: { roomCode: string; playerName: string }, ack: (res: AckResponse<{ playerId: string }>) => void) => void;
  'room:rejoin': (payload: { playerId: string; roomCode: string }, ack: (res: AckResponse<null>) => void) => void;
  'room:assign_team': (payload: { targetPlayerId: string; teamIndex: number }) => void;
  'room:add_team': () => void;
  'room:remove_team': () => void;
  'room:rename_team': (payload: { teamIndex: number; name: string }) => void;
  'room:update_settings': (payload: Partial<GameSettings>) => void;
  'room:start': (ack: (res: AckResponse<null>) => void) => void;

  'turn:guessed': () => void;
  'turn:skipped': () => void;
  /** A player NOT on the active team claims the current word for their team */
  'turn:steal': () => void;
  'turn:confirm_review': () => void;
}

// ─── Server → Client ──────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'turn:your_word': (payload: { word: string; index: number; total: number }) => void;
  'turn:word_result': (payload: {
    word: string;
    status: 'guessed' | 'skipped' | 'stolen';
    scoreChange: number;
    /** Name of the team that stole, if applicable */
    stolenByTeamName?: string;
  }) => void;
  'error': (payload: { message: string }) => void;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export type AckResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
