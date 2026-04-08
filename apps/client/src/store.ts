import { useState, useEffect, useCallback } from 'react';
import type { RoomView } from '@alias/shared';
import { socket } from './socket.js';

// ─── Session storage keys ────────────────────────────────────────────────────
const KEY_PLAYER_ID = 'alias:playerId';
const KEY_ROOM_CODE = 'alias:roomCode';

export function saveSession(playerId: string, roomCode: string) {
  sessionStorage.setItem(KEY_PLAYER_ID, playerId);
  sessionStorage.setItem(KEY_ROOM_CODE, roomCode);
}

export function loadSession(): { playerId: string; roomCode: string } | null {
  const playerId = sessionStorage.getItem(KEY_PLAYER_ID);
  const roomCode = sessionStorage.getItem(KEY_ROOM_CODE);
  if (playerId && roomCode) return { playerId, roomCode };
  return null;
}

export function clearSession() {
  sessionStorage.removeItem(KEY_PLAYER_ID);
  sessionStorage.removeItem(KEY_ROOM_CODE);
}

// ─── Global game state hook ──────────────────────────────────────────────────

export interface GameState {
  room: RoomView | null;
  playerId: string | null;
  /** Word sent exclusively to this player when they are describer */
  currentWord: { word: string; index: number; total: number } | null;
  /** Last word result flash */
  lastWordResult: { word: string; status: 'guessed' | 'skipped' | 'stolen'; scoreChange: number; stolenByTeamName?: string } | null;
  connected: boolean;
}

const initialState: GameState = {
  room: null,
  playerId: null,
  currentWord: null,
  lastWordResult: null,
  connected: false,
};

export function useGameState() {
  const [state, setState] = useState<GameState>(initialState);

  const setPlayerId = useCallback((id: string) => {
    setState(s => ({ ...s, playerId: id }));
  }, []);

  useEffect(() => {
    function onConnect() {
      setState(s => ({ ...s, connected: true }));
    }
    function onDisconnect() {
      setState(s => ({ ...s, connected: false }));
    }
    function onRoomState(room: RoomView) {
      setState(s => ({ ...s, room }));
    }
    function onYourWord(payload: { word: string; index: number; total: number }) {
      setState(s => ({ ...s, currentWord: payload }));
    }
    function onWordResult(payload: { word: string; status: 'guessed' | 'skipped' | 'stolen'; scoreChange: number; stolenByTeamName?: string }) {
      setState(s => ({ ...s, lastWordResult: payload }));
      // Clear the flash after 1.5s
      setTimeout(() => setState(s => ({ ...s, lastWordResult: null })), 1500);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('turn:your_word', onYourWord);
    socket.on('turn:word_result', onWordResult);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('turn:your_word', onYourWord);
      socket.off('turn:word_result', onWordResult);
    };
  }, []);

  return { state, setPlayerId };
}
