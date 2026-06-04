/**
 * Load a question and split it into the server-only truth (correct answer) and
 * the public projection sent to clients (NO correct answer — anti-cheat).
 */
import { AppError, ErrorCode, type PublicQuestion } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';

interface StoredOption {
  id: string;
  textAr: string;
  textEn?: string;
  mediaId?: string;
}

export interface LoadedQuestion {
  questionId: string;
  publicQuestion: PublicQuestion;
  correctOptionId: string;
  timeLimitSec: number;
  basePoints: number;
  speedBonus: boolean;
  explanationAr?: string;
  explanationEn?: string;
}

export async function loadQuestion(questionId: string): Promise<LoadedQuestion> {
  const q = await prisma.question.findFirst({
    where: { id: questionId, deletedAt: null },
    include: {
      promptMedia: { select: { url: true } },
      category: { select: { nameAr: true, nameEn: true, color: true, icon: true } },
    },
  });
  if (!q) throw new AppError(ErrorCode.NOT_FOUND, 'Question not found');

  const stored = (q.options as unknown as StoredOption[]) ?? [];

  // Resolve any option-level media URLs in one batch.
  const mediaIds = stored.map((o) => o.mediaId).filter(Boolean) as string[];
  const mediaMap = new Map<string, string>();
  if (mediaIds.length) {
    const assets = await prisma.mediaAsset.findMany({
      where: { id: { in: mediaIds } },
      select: { id: true, url: true },
    });
    for (const a of assets) if (a.url) mediaMap.set(a.id, a.url);
  }

  const publicQuestion: PublicQuestion = {
    id: q.id,
    type: q.type,
    difficulty: q.difficulty,
    promptAr: q.promptAr,
    promptEn: q.promptEn ?? undefined,
    promptMediaUrl: q.promptMedia?.url ?? undefined,
    category: q.category
      ? {
          nameAr: q.category.nameAr,
          nameEn: q.category.nameEn ?? undefined,
          color: q.category.color,
          icon: q.category.icon ?? undefined,
        }
      : undefined,
    options: stored.map((o) => ({
      id: o.id,
      textAr: o.textAr,
      textEn: o.textEn,
      mediaUrl: o.mediaId ? mediaMap.get(o.mediaId) : undefined,
    })),
  };

  return {
    questionId: q.id,
    publicQuestion,
    correctOptionId: q.correctOptionId,
    timeLimitSec: q.timeLimitSec,
    basePoints: q.basePoints,
    speedBonus: q.speedBonus,
    explanationAr: q.explanationAr ?? undefined,
    explanationEn: q.explanationEn ?? undefined,
  };
}
