/** Singleton Prisma client. */
import { PrismaClient } from '@prisma/client';
import { env, isProd } from '../config/env.js';

export const prisma = new PrismaClient({
  log: isProd ? ['warn', 'error'] : ['warn', 'error'],
  datasources: { db: { url: env.DATABASE_URL } },
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
