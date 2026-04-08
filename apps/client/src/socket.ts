import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@alias/shared';

/**
 * Single shared socket instance.
 * autoConnect: false — we connect manually after the user enters their name.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  transports: ['websocket'],
});
