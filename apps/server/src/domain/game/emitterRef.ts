/**
 * Shared holder for the injected GameEmitter. Both the elimination engine and the
 * Seen-Jeem orchestrator emit through this, so the realtime layer wires the port
 * exactly once (in initEngine) and neither domain module imports Socket.IO.
 */
import type { GameEmitter } from './ports.js';

let ref: GameEmitter | undefined;

export function setEmitter(e: GameEmitter): void {
  ref = e;
}

export function getEmitter(): GameEmitter {
  if (!ref) throw new Error('GameEmitter not initialized');
  return ref;
}
