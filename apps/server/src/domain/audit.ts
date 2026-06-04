/** Append-only admin audit logging (doc 08 §8). */
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface AuditInput {
  actorId: string;
  action: string; // e.g. "question.create"
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as never,
        ip: input.ip,
      },
    });
  } catch (err) {
    // Auditing must never break the request; log and continue.
    logger.error({ err, action: input.action }, 'audit write failed');
  }
}
