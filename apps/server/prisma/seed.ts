/**
 * Idempotent database seed.
 *   pnpm db:seed
 *
 * Creates: a SUPER_ADMIN (from env), a set of bilingual categories, and a free
 * demo package with bilingual questions so a game is playable immediately after
 * a fresh `pnpm db:migrate`.
 *
 * Re-runnable: everything uses upsert keyed on natural unique fields.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { GROUPS, CATEGORIES } from './taxonomy.js';
import { QUESTION_BANK } from './questionBank.js';
import { isAnswerLeak } from './questionFilter.js';

const prisma = new PrismaClient();

const env = (k: string, fallback?: string) => process.env[k] ?? fallback;

async function main() {
  console.log('🌱 Seeding Tahaddi database…');

  // ── Super admin ────────────────────────────────────────────────────────────
  const adminEmail = env('SEED_ADMIN_EMAIL', 'admin@tahaddi.app')!;
  const adminPassword = env('SEED_ADMIN_PASSWORD', 'ChangeMe123!')!;
  const adminName = env('SEED_ADMIN_NAME', 'Super Admin')!;
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { displayName: adminName, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: adminEmail,
      passwordHash,
      displayName: adminName,
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`  ✓ super admin: ${admin.email}`);

  // ── Category groups ───────────────────────────────────────────────────────────
  const groupIds: Record<string, string> = {};
  for (let i = 0; i < GROUPS.length; i++) {
    const g = GROUPS[i]!;
    const row = await prisma.categoryGroup.upsert({
      where: { slug: g.slug },
      update: { nameAr: g.nameAr, nameEn: g.nameEn, color: g.color, icon: g.icon, sortOrder: i },
      create: { slug: g.slug, nameAr: g.nameAr, nameEn: g.nameEn, color: g.color, icon: g.icon, sortOrder: i },
    });
    groupIds[g.slug] = row.id;
  }
  console.log(`  ✓ category groups: ${GROUPS.length}`);

  // ── Categories (grouped taxonomy) ─────────────────────────────────────────────
  // Categories inherit their group's colour for a cohesive picker. Existing slugs
  // (general, geography, history, science, sports, arab-world) keep their question
  // links — only their group/name/colour are updated.
  const groupColor = Object.fromEntries(GROUPS.map((g) => [g.slug, g.color]));
  const categories: Record<string, string> = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const fields = {
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      color: groupColor[c.group] ?? '#7C3AED',
      icon: GROUPS.find((g) => g.slug === c.group)?.icon ?? null,
      sortOrder: i,
      groupId: groupIds[c.group]!,
    };
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: fields,
      create: { slug: c.slug, ...fields },
    });
    categories[c.slug] = cat.id;
  }
  console.log(`  ✓ categories: ${CATEGORIES.length}`);

  // ── Questions (from the static bank) ──────────────────────────────────────────
  // Seed every category present in the bank. Idempotent by (categoryId, promptAr),
  // so re-running updates in place. The apps read these from the DB at runtime —
  // no AI/API involved in serving questions.
  let totalQuestions = 0;
  let skippedLeaks = 0;
  const sampleForPackage: string[] = []; // a mixed sample backs the fallback "demo" package
  for (const [slug, questions] of Object.entries(QUESTION_BANK)) {
    const categoryId = categories[slug];
    if (!categoryId) continue; // bank slug not in taxonomy — skip
    for (const q of questions) {
      // Skip "answer-leak" questions — where the correct answer is spelled out in
      // the prompt itself (client request: such questions must be filtered out).
      if (isAnswerLeak(q.ar, q.o[q.c] ?? '')) {
        skippedLeaks++;
        continue;
      }
      const optionDefs = q.o.map((text, i) => ({ id: String.fromCharCode(97 + i), textAr: text }));
      const data = {
        type: 'MULTIPLE_CHOICE' as const,
        difficulty: (q.d ?? 'MEDIUM') as Prisma.QuestionCreateInput['difficulty'],
        categoryId,
        promptAr: q.ar,
        promptEn: q.en,
        options: optionDefs as unknown as Prisma.InputJsonValue,
        correctOptionId: optionDefs[q.c]!.id,
        timeLimitSec: 15,
        basePoints: 100,
        speedBonus: true,
        isApproved: true,
      };
      const existing = await prisma.question.findFirst({
        where: { categoryId, promptAr: q.ar },
        select: { id: true },
      });
      const saved = existing
        ? await prisma.question.update({ where: { id: existing.id }, data })
        : await prisma.question.create({ data });
      totalQuestions++;
      if (sampleForPackage.length < 60) sampleForPackage.push(saved.id);
    }
  }
  const createdQuestionIds = sampleForPackage;
  console.log(`  ✓ questions: ${totalQuestions} (${Object.keys(QUESTION_BANK).length} categories)`);
  console.log(`  ⊘ filtered ${skippedLeaks} answer-leak questions (answer visible in prompt)`);

  // Clean up any answer-leak questions left over from earlier seeds: soft-delete
  // them so live games (which filter `deletedAt: null`) never serve them again.
  const liveQuestions = await prisma.question.findMany({
    where: { deletedAt: null },
    select: { id: true, promptAr: true, options: true, correctOptionId: true },
  });
  let purgedLeaks = 0;
  for (const q of liveQuestions) {
    const opts = (q.options as unknown as { id: string; textAr: string }[]) ?? [];
    const correct = opts.find((o) => o.id === q.correctOptionId)?.textAr ?? '';
    if (isAnswerLeak(q.promptAr, correct)) {
      await prisma.question.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
      purgedLeaks++;
    }
  }
  if (purgedLeaks > 0) console.log(`  ⊘ soft-deleted ${purgedLeaks} pre-existing answer-leak questions`);

  // ── Demo package ──────────────────────────────────────────────────────────────
  const pkg = await prisma.package.upsert({
    where: { slug: 'demo-mixed' },
    update: { isPublished: true, isPremium: false, titleAr: 'الباقة التجريبية', titleEn: 'Demo Pack' },
    create: {
      slug: 'demo-mixed',
      titleAr: 'الباقة التجريبية',
      titleEn: 'Demo Pack',
      descAr: 'تشكيلة متنوعة من الأسئلة لبدء اللعب فوراً',
      descEn: 'A mixed set of questions to start playing instantly',
      isPublished: true,
      isPremium: false,
      priceMinor: 0,
      currency: 'SAR',
      createdById: admin.id,
    },
  });

  // Reset & relink package questions in order.
  await prisma.packageQuestion.deleteMany({ where: { packageId: pkg.id } });
  await prisma.packageQuestion.createMany({
    data: createdQuestionIds.map((questionId, order) => ({
      packageId: pkg.id,
      questionId,
      order,
    })),
  });
  console.log(`  ✓ package "${pkg.slug}" with ${createdQuestionIds.length} questions`);

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
