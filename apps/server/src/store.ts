import type { GameRoom, Player, Team } from '@alias/shared';

/** All active rooms keyed by roomId */
const rooms = new Map<string, GameRoom>();

/** Quick lookup: socketId → { roomId, playerId } */
const socketIndex = new Map<string, { roomId: string; playerId: string }>();

export const store = {
  // ─── Room ───────────────────────────────────────────────────────────────────

  getRoom(roomId: string): GameRoom | undefined {
    return rooms.get(roomId);
  },

  getRoomByCode(roomCode: string): GameRoom | undefined {
    for (const room of rooms.values()) {
      if (room.roomCode === roomCode.toUpperCase()) return room;
    }
    return undefined;
  },

  setRoom(room: GameRoom): void {
    rooms.set(room.roomId, room);
  },

  deleteRoom(roomId: string): void {
    rooms.delete(roomId);
  },

  // ─── Socket index ───────────────────────────────────────────────────────────

  indexSocket(socketId: string, roomId: string, playerId: string): void {
    socketIndex.set(socketId, { roomId, playerId });
  },

  lookupSocket(socketId: string): { roomId: string; playerId: string } | undefined {
    return socketIndex.get(socketId);
  },

  removeSocket(socketId: string): void {
    socketIndex.delete(socketId);
  },
};
