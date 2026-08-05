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
import {
  GROUPS,
  CATEGORIES,
  BANK_ALIASES,
  RETIRED_CATEGORY_SLUGS,
  RETIRED_GROUP_SLUGS,
} from './taxonomy.js';

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
  // Array order in taxonomy.ts IS the display order — except for a group the owner
  // moved in the admin panel (sortEdited), whose position is theirs to keep.
  const groupIds: Record<string, string> = {};
  for (let i = 0; i < GROUPS.length; i++) {
    const g = GROUPS[i]!;
    const existing = await prisma.categoryGroup.findUnique({
      where: { slug: g.slug },
      select: { sortEdited: true },
    });
    const names = { nameAr: g.nameAr, nameEn: g.nameEn, color: g.color, icon: g.icon };
    const row = await prisma.categoryGroup.upsert({
      where: { slug: g.slug },
      update: existing?.sortEdited ? names : { ...names, sortOrder: i },
      create: { slug: g.slug, ...names, sortOrder: i },
    });
    groupIds[g.slug] = row.id;
  }
  console.log(`  ✓ category groups: ${GROUPS.length}`);

  // ── Categories (grouped taxonomy) ─────────────────────────────────────────────
  // Categories inherit their group's colour for a cohesive picker. Existing slugs
  // (general, geography, history, science, sports, arab-world) keep their question
  // links — only their group/name/colour are updated.
  // A category the owner edited in the admin panel (name, colour, or parent group)
  // is left alone here apart from its ordering: once they've touched it, the panel is
  // the source of truth, not the taxonomy. Otherwise a re-seed would silently drag a
  // recoloured or re-filed category back to its taxonomy defaults.
  const groupColor = Object.fromEntries(GROUPS.map((g) => [g.slug, g.color]));
  const categories: Record<string, string> = {};
  let keptNames = 0;
  let keptOrder = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i]!;
    const look = {
      color: groupColor[c.group] ?? '#7C3AED',
      icon: GROUPS.find((g) => g.slug === c.group)?.icon ?? null,
      groupId: groupIds[c.group]!,
    };
    const names = { nameAr: c.nameAr, nameEn: c.nameEn };
    const existing = await prisma.category.findUnique({
      where: { slug: c.slug },
      select: { id: true, adminEdited: true, sortEdited: true },
    });
    if (existing?.adminEdited) keptNames++;
    if (existing?.sortEdited) keptOrder++;
    // Two independent opt-outs: `adminEdited` guards the name/colour/group, and
    // `sortEdited` guards the position. A category the owner never touched follows
    // the taxonomy in both respects. A category resurrected by the taxonomy comes
    // back to life (deletedAt: null) — that's how an un-retired slug returns.
    const order = existing?.sortEdited ? {} : { sortOrder: i };
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: existing?.adminEdited ? order : { ...look, ...names, ...order, deletedAt: null },
      create: { slug: c.slug, ...look, ...names, sortOrder: i },
    });
    categories[c.slug] = cat.id;
  }
  console.log(
    `  ✓ categories: ${CATEGORIES.length}` +
      `${keptNames ? ` (${keptNames} kept their admin-set name/colour/group)` : ''}` +
      `${keptOrder ? ` (${keptOrder} kept their admin-set position)` : ''}`,
  );

  // ── Retire the categories the 2026-08-05 restructure dropped ──────────────────
  // Their questions are not lost: BANK_ALIASES re-files each dropped bank under the
  // category that absorbed it (the 18 per-country banks → العالم العربي / الخليج
  // العربي، بنوك البطولات → كرة القدم الآسيوية/الأفريقية…). Only the empty shells go.
  // An explicit list, never "anything missing from the taxonomy", so a category the
  // owner added by hand in the panel is never swept up by a content deploy.
  const retiredCats = await prisma.category.updateMany({
    where: { slug: { in: RETIRED_CATEGORY_SLUGS }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (retiredCats.count > 0) console.log(`  ⊘ retired ${retiredCats.count} categories folded into others`);

  // Groups the restructure emptied. Deleted outright rather than hidden — a group has
  // no soft-delete, and an empty one would still show as a filter chip in the panel.
  // Guarded on being genuinely empty so a group still holding a category survives.
  for (const slug of RETIRED_GROUP_SLUGS) {
    const g = await prisma.categoryGroup.findUnique({
      where: { slug },
      select: { id: true, _count: { select: { categories: { where: { deletedAt: null } } } } },
    });
    if (!g || g._count.categories > 0) continue;
    await prisma.category.updateMany({ where: { groupId: g.id }, data: { groupId: null } });
    await prisma.categoryGroup.delete({ where: { id: g.id } });
    console.log(`  ⊘ removed empty group "${slug}"`);
  }

  // ── Questions (from the static bank) ──────────────────────────────────────────
  // Seed every category present in the bank. Idempotent by (categoryId, promptAr),
  // so re-running updates in place. The apps read these from the DB at runtime —
  // no AI/API involved in serving questions.
  let totalQuestions = 0;
  let skippedLeaks = 0;
  let skippedDupes = 0;
  let keptQuestions = 0; // edited/deleted in the admin panel — left untouched
  // Global de-dup by NORMALIZED prompt (ignores diacritics / alef-hamza / ta-marbuta
  // variants) so the same question can't be seeded twice — not within a category, and
  // not across categories. Prevents a game from ever showing the same question again
  // (client feedback 2026-07-20: "أسئلة متكررة"). First occurrence in bank order wins.
  const seenNorm = new Set<string>();
  const bankIds = new Set<string>(); // every question this run seeded from the bank
  const sampleForPackage: string[] = []; // a mixed sample backs the fallback "demo" package
  for (const [key, questions] of Object.entries(QUESTION_BANK)) {
    // A bank key is normally a live category slug. Keys whose category was folded
    // into another by the restructure resolve through BANK_ALIASES instead, so the
    // content keeps playing under its new home.
    const slug = BANK_ALIASES[key] ?? key;
    const categoryId = categories[slug];
    if (!categoryId) continue; // bank key maps to nothing in the taxonomy — skip
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
        // Marks the row as bank-owned; the prune below only ever retires these.
        tags: ['bank'],
        deletedAt: null, // a question re-added to the bank comes back to life
      };
      const existing = await prisma.question.findFirst({
        where: { categoryId, promptAr: q.ar },
        select: { id: true, tags: true, deletedAt: true },
      });
      // Hands off anything the owner touched in the panel: an edited question keeps
      // their wording, and one they deleted stays deleted (the `data` above resets
      // deletedAt, which used to resurrect it on every content deploy).
      if (existing && (existing.tags ?? []).includes('admin')) {
        keptQuestions++;
        bankIds.add(existing.id);
        if (!existing.deletedAt && sampleForPackage.length < 60) sampleForPackage.push(existing.id);
        continue;
      }
      const saved = existing
        ? await prisma.question.update({ where: { id: existing.id }, data })
        : await prisma.question.create({ data });
      totalQuestions++;
      bankIds.add(saved.id);
      if (sampleForPackage.length < 60) sampleForPackage.push(saved.id);
    }
  }
  const createdQuestionIds = sampleForPackage;
  console.log(`  ✓ questions: ${totalQuestions} (${Object.keys(QUESTION_BANK).length} categories)`);
  console.log(`  ⊘ filtered ${skippedLeaks} answer-leak questions (answer visible in prompt)`);
  console.log(`  ⊘ filtered ${skippedDupes} duplicate questions (already seeded)`);
  if (keptQuestions > 0) console.log(`  ✋ kept ${keptQuestions} questions edited/deleted in the admin panel`);

  // ── Retire questions dropped from the bank ────────────────────────────────────
  // The bank is the source of truth. Rewriting a category (e.g. المشاهير → مشاهير
  // العرب) used to leave the OLD questions live forever, because the seed only ever
  // upserts — so a rewritten category served both the new and the replaced content.
  // Anything bank-owned (tags contains 'bank') that this run did NOT seed is retired.
  // Questions added by an editor ('admin') or generated by the AI ('ai') are never
  // touched, and neither is anything from a seed that predates tagging… except the
  // untagged legacy rows, which ARE stale bank content by definition (nothing else
  // wrote to this table) and so are retired too.
  // Filtered in JS, not SQL: the oldest rows have `tags = NULL` (they predate the
  // column's default), and a `NOT { tags: { hasSome } }` filter evaluates to NULL
  // for those — so they silently survived the prune.
  //
  // Runs BEFORE the duplicate purge below, and must stay there. A question whose
  // category changed (the 2026-08-05 restructure re-filed thousands of them) exists
  // twice at this point: the fresh row under the new category, and the stale row
  // under the retired one. The duplicate purge keeps the OLDEST copy — i.e. the stale
  // one — so if it ran first it would delete the new row, and this pass would then
  // retire the old one as well, losing the question entirely.
  const liveNow = await prisma.question.findMany({
    where: { deletedAt: null },
    select: { id: true, tags: true },
  });
  const retireIds = liveNow
    .filter((q) => !bankIds.has(q.id) && !(q.tags ?? []).some((t) => t === 'admin' || t === 'ai'))
    .map((q) => q.id);
  if (retireIds.length > 0) {
    for (let i = 0; i < retireIds.length; i += 500) {
      await prisma.question.updateMany({
        where: { id: { in: retireIds.slice(i, i + 500) } },
        data: { deletedAt: new Date() },
      });
    }
    console.log(`  ⊘ retired ${retireIds.length} questions no longer in the bank`);
  }

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

  // Retire the "very hard" tier for good (client 2026-07-28: «الأسئلة الصعبة جداً
  // احذفها»). EXPERT rows are dropped from the bank above; this clears any that a
  // previous seed (or the AI generator) already wrote to the DB. The draw also
  // filters EXPERT out, so this is belt-and-braces.
  const purgedExpert = await prisma.question.updateMany({
    where: { difficulty: 'EXPERT', deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (purgedExpert.count > 0) console.log(`  ⊘ soft-deleted ${purgedExpert.count} EXPERT (very hard) questions`);

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
  // Pricing set in the admin panel wins (adminEdited): the owner re-prices from there,
  // so a content deploy must not quietly reset the storefront to the numbers below.
  let keptPrices = 0;
  for (let i = 0; i < CREDIT_PACKAGES.length; i++) {
    const p = CREDIT_PACKAGES[i]!;
    const owned = await prisma.product.findUnique({
      where: { sku: p.sku },
      select: { adminEdited: true },
    });
    if (owned?.adminEdited) {
      keptPrices++;
      continue;
    }
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
  console.log(`  ✓ ${CREDIT_PACKAGES.length} credit packages (1/2/5/10 games)${keptPrices ? ` — ${keptPrices} kept their admin-set price` : ''}`);

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
