import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as IOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@alias/shared';
import { registerHandlers } from './socket/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const app = Fastify({ logger: false });

// In production, serve the built client from the same process
if (IS_PROD) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  await app.register(fastifyStatic, { root: clientDist });
  // SPA fallback — serve index.html for all non-API routes
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(
  app.server,
  IS_PROD
    ? {}
    : { cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] } },
);

app.get('/health', async () => ({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerHandlers(io, socket);
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
});
