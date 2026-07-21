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

/** Paid catalog: game-credit packages. Kept in sync with shared CREDIT_PACKAGES;
 *  inlined here so the seed is self-contained (no cross-package import at run). */
const CREDIT_PACKAGES = [
  { sku: 'game_1', nameAr: 'باقة لعبة واحدة', nameEn: '1 Game', credits: 1, priceMinor: 2000 },
  { sku: 'game_2', nameAr: 'باقة لعبتين', nameEn: '2 Games', credits: 2, priceMinor: 3500 },
  { sku: 'game_5', nameAr: 'باقة ٥ ألعاب', nameEn: '5 Games', credits: 5, priceMinor: 7500 },
  { sku: 'game_10', nameAr: 'باقة ١٠ ألعاب', nameEn: '10 Games', credits: 10, priceMinor: 10000 },
];
import { QUESTION_BANK } from './questionBank.js';
import { isAnswerLeak, normalizeAr } from './questionFilter.js';

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
  let skippedDupes = 0;
  // Global de-dup by NORMALIZED prompt (ignores diacritics / alef-hamza / ta-marbuta
  // variants) so the same question can't be seeded twice — not within a category, and
  // not across categories. Prevents a game from ever showing the same question again
  // (client feedback 2026-07-20: "أسئلة متكررة"). First occurrence in bank order wins.
  const seenNorm = new Set<string>();
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
      // Skip a repeat of a question already seeded (by normalized prompt).
      const norm = normalizeAr(q.ar);
      if (seenNorm.has(norm)) {
        skippedDupes++;
        continue;
      }
      seenNorm.add(norm);
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
  console.log(`  ⊘ filtered ${skippedDupes} duplicate questions (already seeded)`);

  // Clean up leftovers from earlier seeds so live games (which filter
  // `deletedAt: null`) never serve them again:
  //   1. answer-leak questions (the answer is spelled out in the prompt), and
  //   2. duplicate questions (same normalized prompt seeded more than once).
  // Kept oldest-first so a stable copy of each question survives.
  const liveQuestions = await prisma.question.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, promptAr: true, options: true, correctOptionId: true },
  });
  let purgedLeaks = 0;
  let purgedDupes = 0;
  const seenLive = new Set<string>();
  for (const q of liveQuestions) {
    const opts = (q.options as unknown as { id: string; textAr: string }[]) ?? [];
    const correct = opts.find((o) => o.id === q.correctOptionId)?.textAr ?? '';
    if (isAnswerLeak(q.promptAr, correct)) {
      await prisma.question.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
      purgedLeaks++;
      continue;
    }
    const norm = normalizeAr(q.promptAr);
    if (seenLive.has(norm)) {
      await prisma.question.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
      purgedDupes++;
      continue;
    }
    seenLive.add(norm);
  }
  if (purgedLeaks > 0) console.log(`  ⊘ soft-deleted ${purgedLeaks} pre-existing answer-leak questions`);
  if (purgedDupes > 0) console.log(`  ⊘ soft-deleted ${purgedDupes} pre-existing duplicate questions`);

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

  // ── Free tier pack (fixed 15-question, no categories) ──────────────────────────
  // The FREE game serves exactly this set. Paid games use the category bank instead.
  const FREE_QS = createdQuestionIds.slice(0, 15);
  const freePkg = await prisma.package.upsert({
    where: { slug: 'free-15' },
    update: { isPublished: true, isPremium: false, titleAr: 'الباقة المجانية', titleEn: 'Free Pack' },
    create: {
      slug: 'free-15',
      titleAr: 'الباقة المجانية',
      titleEn: 'Free Pack',
      descAr: '١٥ سؤالاً متنوعاً — النسخة المجانية',
      descEn: '15 mixed questions — the free version',
      isPublished: true,
      isPremium: false,
      priceMinor: 0,
      currency: 'SAR',
      createdById: admin.id,
    },
  });
  await prisma.packageQuestion.deleteMany({ where: { packageId: freePkg.id } });
  await prisma.packageQuestion.createMany({
    data: FREE_QS.map((questionId, order) => ({ packageId: freePkg.id, questionId, order })),
  });
  console.log(`  ✓ free pack "${freePkg.slug}" with ${FREE_QS.length} questions`);

  // ── Paid catalog: game-credit packages ─────────────────────────────────────────
  // Each package adds `credits` game-starts to the host's wallet; a PAID (35-Q)
  // game consumes one credit. Prices in minor units (halalas; 2000 = 20 SAR).
  for (let i = 0; i < CREDIT_PACKAGES.length; i++) {
    const p = CREDIT_PACKAGES[i]!;
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { nameAr: p.nameAr, nameEn: p.nameEn, kind: 'CREDITS', credits: p.credits, priceMinor: p.priceMinor, isActive: true, sortOrder: i },
      create: {
        sku: p.sku,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        kind: 'CREDITS',
        credits: p.credits,
        priceMinor: p.priceMinor,
        currency: 'SAR',
        isActive: true,
        sortOrder: i,
      },
    });
  }
  console.log(`  ✓ ${CREDIT_PACKAGES.length} credit packages (1/2/5/10 games)`);

  // Retire the legacy one-time unlock so the storefront lists only the packages.
  await prisma.product.updateMany({ where: { sku: 'paid_unlock' }, data: { isActive: false } });

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
