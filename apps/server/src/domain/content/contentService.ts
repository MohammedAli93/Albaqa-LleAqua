/** Content CRUD: categories, questions, packages. Validation done at the router
 *  boundary via shared Zod schemas; this layer enforces invariants & soft-delete. */
import { AppError, ErrorCode, type Page } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

// ── Categories ───────────────────────────────────────────────────────────────

export function listCategories() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    // questionCount drives the admin's category-first question browser (pick a
    // category → see its questions), so it must exclude soft-deleted rows.
    include: { _count: { select: { questions: { where: { deletedAt: null } } } } },
  });
}

/** Public grouped category catalog for the create-game picker. */
export function listCategoryGroups() {
  return prisma.categoryGroup.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      color: true,
      icon: true,
      categories: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, slug: true, nameAr: true, nameEn: true, color: true, icon: true },
      },
    },
  });
}

export function createCategory(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
  await ensureExists('category', id);
  return prisma.category.update({ where: { id }, data });
}

export async function softDeleteCategory(id: string) {
  await ensureExists('category', id);
  return prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ── Questions ────────────────────────────────────────────────────────────────

export interface QuestionFilter {
  categoryId?: string;
  type?: string;
  difficulty?: string;
  isApproved?: boolean;
  q?: string;
}

export async function listQuestions(
  filter: QuestionFilter,
  cursor: string | undefined,
  limit: number,
): Promise<Page<unknown>> {
  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    ...(filter.categoryId && { categoryId: filter.categoryId }),
    ...(filter.type && { type: filter.type as never }),
    ...(filter.difficulty && { difficulty: filter.difficulty as never }),
    ...(filter.isApproved !== undefined && { isApproved: filter.isApproved }),
    ...(filter.q && { promptAr: { contains: filter.q, mode: 'insensitive' } }),
  };
  const items = await prisma.question.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: { category: { select: { id: true, nameAr: true, nameEn: true, color: true } } },
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

export async function getQuestion(id: string) {
  const q = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw new AppError(ErrorCode.NOT_FOUND, 'Question not found');
  return q;
}

export function createQuestion(data: Prisma.QuestionUncheckedCreateInput) {
  return prisma.question.create({ data });
}

/**
 * An edit made in the panel wins over the static bank. Tagging the row 'admin' is what
 * tells the seed to leave it alone — otherwise the next content deploy would upsert
 * the bank's original wording straight back over the owner's correction.
 */
export async function updateQuestion(id: string, data: Prisma.QuestionUncheckedUpdateInput) {
  await ensureExists('question', id);
  return prisma.question.update({ where: { id }, data: { ...data, tags: await withAdminTag(id, data.tags) } });
}

/** Same reasoning as an edit: a question the owner deleted must not come back on re-seed. */
export async function softDeleteQuestion(id: string) {
  await ensureExists('question', id);
  return prisma.question.update({
    where: { id },
    data: { deletedAt: new Date(), tags: await withAdminTag(id) },
  });
}

/** The question's tags plus 'admin', preserving whatever the caller is already setting. */
async function withAdminTag(id: string, incoming?: Prisma.QuestionUncheckedUpdateInput['tags']): Promise<string[]> {
  let tags: string[];
  if (Array.isArray(incoming)) tags = incoming as string[];
  else if (incoming && typeof incoming === 'object' && 'set' in incoming) tags = (incoming.set as string[]) ?? [];
  else tags = (await prisma.question.findUnique({ where: { id }, select: { tags: true } }))?.tags ?? [];
  return tags.includes('admin') ? tags : [...tags, 'admin'];
}

export async function setApproved(id: string, isApproved: boolean) {
  await ensureExists('question', id);
  return prisma.question.update({ where: { id }, data: { isApproved } });
}

// ── Packages ─────────────────────────────────────────────────────────────────

export function listPackages() {
  return prisma.package.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { questions: true } } },
  });
}

export function listPublicPackages() {
  return prisma.package.findMany({
    where: { deletedAt: null, isPublished: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, titleAr: true, titleEn: true, descAr: true, descEn: true,
      isPremium: true, priceMinor: true, currency: true,
      _count: { select: { questions: true } },
    },
  });
}

export function createPackage(data: Prisma.PackageUncheckedCreateInput) {
  return prisma.package.create({ data });
}

export async function updatePackage(id: string, data: Prisma.PackageUncheckedUpdateInput) {
  await ensureExists('package', id);
  return prisma.package.update({ where: { id }, data });
}

export async function setPackageQuestions(
  packageId: string,
  questions: Array<{ questionId: string; order: number }>,
) {
  await ensureExists('package', packageId);
  return prisma.$transaction(async (tx) => {
    await tx.packageQuestion.deleteMany({ where: { packageId } });
    if (questions.length) {
      await tx.packageQuestion.createMany({
        data: questions.map((q) => ({ packageId, questionId: q.questionId, order: q.order })),
      });
    }
    return tx.package.findUnique({ where: { id: packageId }, include: { _count: { select: { questions: true } } } });
  });
}

export async function publishPackage(id: string, isPublished: boolean) {
  await ensureExists('package', id);
  // Cannot publish an empty package.
  if (isPublished) {
    const count = await prisma.packageQuestion.count({ where: { packageId: id } });
    if (count === 0) throw new AppError(ErrorCode.CONFLICT, 'Cannot publish an empty package');
  }
  return prisma.package.update({ where: { id }, data: { isPublished } });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function ensureExists(model: 'category' | 'question' | 'package', id: string): Promise<void> {
  const found = await (prisma[model] as { findFirst: (a: unknown) => Promise<unknown> }).findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!found) throw new AppError(ErrorCode.NOT_FOUND, `${model} not found`);
}
