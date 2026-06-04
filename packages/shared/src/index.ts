/**
 * @tahaddi/shared — the wire contract.
 *
 * Imported by the server AND all three clients so that domain vocabulary,
 * event/payload schemas, REST DTOs, error codes and the avatar catalogue have a
 * single source of truth. A breaking change here is a compile error on both
 * sides, never a silent production drift.
 */
export * from './domain.js';
export * from './avatars.js';
export * from './errors.js';
export * from './events.js';
export * from './seenjeem.js';
export * from './rest.js';
