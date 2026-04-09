import { useState, useEffect, useCallback } from 'react';
import type { RoomView } from '@alias/shared';
import { socket } from './socket.js';

// ─── Session storage keys ────────────────────────────────────────────────────
const KEY_PLAYER_ID = 'alias:playerId';
const KEY_ROOM_CODE = 'alias:roomCode';

export function saveSession(playerId: string, roomCode: string) {
  localStorage.setItem(KEY_PLAYER_ID, playerId);
  localStorage.setItem(KEY_ROOM_CODE, roomCode);
}

export function loadSession(): { playerId: string; roomCode: string } | null {
  const playerId = localStorage.getItem(KEY_PLAYER_ID);
  const roomCode = localStorage.getItem(KEY_ROOM_CODE);
  if (playerId && roomCode) return { playerId, roomCode };
  return null;
}

export function clearSession() {
  localStorage.removeItem(KEY_PLAYER_ID);
  localStorage.removeItem(KEY_ROOM_CODE);
}

// ─── Global game state hook ──────────────────────────────────────────────────

export interface GameState {
  room: RoomView | null;
  playerId: string | null;
  currentWord: { word: string; index: number; total: number } | null;
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

      // On (re)connect, try to rejoin saved session
      const session = loadSession();
      if (session) {
        socket.emit('room:rejoin', { playerId: session.playerId, roomCode: session.roomCode }, (res) => {
          if (res.ok) {
            setState(s => ({ ...s, playerId: session.playerId }));
          } else {
            // Session expired — clear it
            clearSession();
          }
        });
      }
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
      setTimeout(() => setState(s => ({ ...s, lastWordResult: null })), 1500);
    }
    function onRoomClosed() {
      clearSession();
      setState(initialState);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onRoomState);
    socket.on('turn:your_word', onYourWord);
    socket.on('turn:word_result', onWordResult);
    socket.on('room:closed', onRoomClosed);

    // Auto-connect on mount if we have a saved session
    if (loadSession() && !socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onRoomState);
      socket.off('turn:your_word', onYourWord);
      socket.off('turn:word_result', onWordResult);
      socket.off('room:closed', onRoomClosed);
    };
  }, []);

  return { state, setPlayerId };
}
