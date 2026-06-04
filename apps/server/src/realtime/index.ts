/**
 * Realtime layer entry point. Creates the Socket.IO server with the Redis adapter
 * (cross-replica broadcasts), wires the three namespaces, and injects the emitter
 * into the game engine.
 */
import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ALLOWED_ORIGINS } from '../config/env.js';
import { pubClient, subClient } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { clearAllTimers } from '../domain/game/timer.js';
import { initEngine } from '../domain/game/engine.js';
import { createEmitter } from './emitter.js';
import { registerScreenNamespace } from './namespaces/screen.ns.js';
import { registerPlayNamespace } from './namespaces/play.ns.js';
import { registerAdminNamespace } from './namespaces/admin.ns.js';
import './socketContext.js';

let io: IOServer | null = null;

export async function attachRealtime(httpServer: HttpServer): Promise<IOServer> {
  io = new IOServer(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
    perMessageDeflate: { threshold: 4096 },
  });

  io.adapter(createAdapter(pubClient, subClient));

  const screenNs = io.of('/screen');
  const playNs = io.of('/play');
  const adminNs = io.of('/admin');

  // Inject the emitter port into the engine (domain never imports Socket.IO).
  initEngine(createEmitter(screenNs, playNs));

  registerScreenNamespace(screenNs);
  registerPlayNamespace(playNs);
  registerAdminNamespace(adminNs);

  logger.info('🔌 realtime layer attached (/screen, /play, /admin)');
  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('realtime not attached');
  return io;
}

export async function shutdownRealtime(): Promise<void> {
  clearAllTimers();
  if (io) {
    await io.close();
    io = null;
  }
}
