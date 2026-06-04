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

const prisma = new PrismaClient();

const env = (k: string, fallback?: string) => process.env[k] ?? fallback;

/** Helper to build a 4-option multiple-choice question payload. */
function mcq(
  promptAr: string,
  promptEn: string,
  options: Array<{ ar: string; en: string }>,
  correctIndex: number,
  opts: Partial<{ difficulty: Prisma.QuestionCreateInput['difficulty']; explanationAr: string; explanationEn: string }> = {},
) {
  const optionDefs = options.map((o, i) => ({
    id: String.fromCharCode(97 + i), // 'a','b','c','d'
    textAr: o.ar,
    textEn: o.en,
  }));
  return {
    promptAr,
    promptEn,
    options: optionDefs as unknown as Prisma.InputJsonValue,
    correctOptionId: optionDefs[correctIndex]!.id,
    difficulty: opts.difficulty ?? 'MEDIUM',
    explanationAr: opts.explanationAr,
    explanationEn: opts.explanationEn,
  };
}

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

  // ── Categories ──────────────────────────────────────────────────────────────
  const categoryDefs = [
    { slug: 'general', nameAr: 'معلومات عامة', nameEn: 'General Knowledge', color: '#7C3AED', icon: 'brain', sortOrder: 0 },
    { slug: 'geography', nameAr: 'جغرافيا', nameEn: 'Geography', color: '#22D3EE', icon: 'globe', sortOrder: 1 },
    { slug: 'history', nameAr: 'تاريخ', nameEn: 'History', color: '#F59E0B', icon: 'scroll', sortOrder: 2 },
    { slug: 'science', nameAr: 'علوم', nameEn: 'Science', color: '#22C55E', icon: 'flask-conical', sortOrder: 3 },
    { slug: 'sports', nameAr: 'رياضة', nameEn: 'Sports', color: '#EF4444', icon: 'trophy', sortOrder: 4 },
    { slug: 'arab-world', nameAr: 'العالم العربي', nameEn: 'Arab World', color: '#C026D3', icon: 'star', sortOrder: 5 },
  ];

  const categories: Record<string, string> = {};
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameAr: c.nameAr, nameEn: c.nameEn, color: c.color, icon: c.icon, sortOrder: c.sortOrder },
      create: c,
    });
    categories[c.slug] = cat.id;
  }
  console.log(`  ✓ categories: ${categoryDefs.length}`);

  // ── Demo questions (bilingual) ───────────────────────────────────────────────
  const questionsByCategory: Record<string, ReturnType<typeof mcq>[]> = {
    geography: [
      mcq('ما هي عاصمة المملكة العربية السعودية؟', 'What is the capital of Saudi Arabia?',
        [{ ar: 'جدة', en: 'Jeddah' }, { ar: 'الرياض', en: 'Riyadh' }, { ar: 'مكة', en: 'Mecca' }, { ar: 'الدمام', en: 'Dammam' }], 1, { difficulty: 'EASY' }),
      mcq('ما هو أطول نهر في العالم؟', 'What is the longest river in the world?',
        [{ ar: 'النيل', en: 'Nile' }, { ar: 'الأمازون', en: 'Amazon' }, { ar: 'المسيسيبي', en: 'Mississippi' }, { ar: 'اليانغتسي', en: 'Yangtze' }], 0, { difficulty: 'MEDIUM' }),
      mcq('في أي قارة تقع دولة مصر؟', 'On which continent is Egypt located?',
        [{ ar: 'آسيا', en: 'Asia' }, { ar: 'أوروبا', en: 'Europe' }, { ar: 'إفريقيا', en: 'Africa' }, { ar: 'أستراليا', en: 'Australia' }], 2, { difficulty: 'EASY' }),
      mcq('ما هي أكبر دولة عربية من حيث المساحة؟', 'Which is the largest Arab country by area?',
        [{ ar: 'مصر', en: 'Egypt' }, { ar: 'الجزائر', en: 'Algeria' }, { ar: 'السعودية', en: 'Saudi Arabia' }, { ar: 'السودان', en: 'Sudan' }], 1, { difficulty: 'HARD' }),
    ],
    history: [
      mcq('في أي عام بدأت الحرب العالمية الأولى؟', 'In which year did World War I begin?',
        [{ ar: '1914', en: '1914' }, { ar: '1918', en: '1918' }, { ar: '1939', en: '1939' }, { ar: '1905', en: '1905' }], 0, { difficulty: 'MEDIUM' }),
      mcq('من هو مؤسس المملكة العربية السعودية الحديثة؟', 'Who founded modern Saudi Arabia?',
        [{ ar: 'الملك فيصل', en: 'King Faisal' }, { ar: 'الملك عبدالعزيز', en: 'King Abdulaziz' }, { ar: 'الملك سعود', en: 'King Saud' }, { ar: 'الملك خالد', en: 'King Khalid' }], 1, { difficulty: 'EASY' }),
      mcq('أي حضارة بنت الأهرامات؟', 'Which civilization built the pyramids?',
        [{ ar: 'الرومانية', en: 'Roman' }, { ar: 'الإغريقية', en: 'Greek' }, { ar: 'المصرية القديمة', en: 'Ancient Egyptian' }, { ar: 'الفارسية', en: 'Persian' }], 2, { difficulty: 'EASY' }),
    ],
    science: [
      mcq('ما هو الرمز الكيميائي للذهب؟', 'What is the chemical symbol for gold?',
        [{ ar: 'Au', en: 'Au' }, { ar: 'Ag', en: 'Ag' }, { ar: 'Go', en: 'Go' }, { ar: 'Gd', en: 'Gd' }], 0, { difficulty: 'MEDIUM' }),
      mcq('كم عدد كواكب المجموعة الشمسية؟', 'How many planets are in the solar system?',
        [{ ar: '7', en: '7' }, { ar: '8', en: '8' }, { ar: '9', en: '9' }, { ar: '10', en: '10' }], 1, { difficulty: 'EASY' }),
      mcq('ما هو أكبر عضو في جسم الإنسان؟', 'What is the largest organ in the human body?',
        [{ ar: 'الكبد', en: 'Liver' }, { ar: 'الدماغ', en: 'Brain' }, { ar: 'الجلد', en: 'Skin' }, { ar: 'الرئة', en: 'Lung' }], 2, { difficulty: 'MEDIUM' }),
      mcq('ما الغاز الذي تمتصه النباتات من الهواء؟', 'Which gas do plants absorb from the air?',
        [{ ar: 'الأكسجين', en: 'Oxygen' }, { ar: 'النيتروجين', en: 'Nitrogen' }, { ar: 'ثاني أكسيد الكربون', en: 'Carbon dioxide' }, { ar: 'الهيدروجين', en: 'Hydrogen' }], 2, { difficulty: 'EASY' }),
    ],
    sports: [
      mcq('كم عدد لاعبي فريق كرة القدم في الملعب؟', 'How many players are on a football team on the field?',
        [{ ar: '9', en: '9' }, { ar: '10', en: '10' }, { ar: '11', en: '11' }, { ar: '12', en: '12' }], 2, { difficulty: 'EASY' }),
      mcq('أي دولة فازت بكأس العالم 2022؟', 'Which country won the 2022 World Cup?',
        [{ ar: 'فرنسا', en: 'France' }, { ar: 'الأرجنتين', en: 'Argentina' }, { ar: 'البرازيل', en: 'Brazil' }, { ar: 'ألمانيا', en: 'Germany' }], 1, { difficulty: 'MEDIUM' }),
      mcq('كل كم سنة تقام الألعاب الأولمبية الصيفية؟', 'Every how many years are the Summer Olympics held?',
        [{ ar: '2', en: '2' }, { ar: '3', en: '3' }, { ar: '4', en: '4' }, { ar: '5', en: '5' }], 2, { difficulty: 'EASY' }),
    ],
    general: [
      mcq('كم عدد ألوان قوس قزح؟', 'How many colors are in a rainbow?',
        [{ ar: '5', en: '5' }, { ar: '6', en: '6' }, { ar: '7', en: '7' }, { ar: '8', en: '8' }], 2, { difficulty: 'EASY' }),
      mcq('ما هي اللغة الأكثر تحدثاً في العالم كلغة أم؟', 'Which language has the most native speakers?',
        [{ ar: 'الإنجليزية', en: 'English' }, { ar: 'الماندرين', en: 'Mandarin' }, { ar: 'الإسبانية', en: 'Spanish' }, { ar: 'العربية', en: 'Arabic' }], 1, { difficulty: 'HARD' }),
      mcq('كم عدد أيام السنة الكبيسة؟', 'How many days are in a leap year?',
        [{ ar: '364', en: '364' }, { ar: '365', en: '365' }, { ar: '366', en: '366' }, { ar: '367', en: '367' }], 2, { difficulty: 'MEDIUM' }),
    ],
    'arab-world': [
      mcq('ما هي عملة دولة الكويت؟', 'What is the currency of Kuwait?',
        [{ ar: 'الريال', en: 'Riyal' }, { ar: 'الدينار', en: 'Dinar' }, { ar: 'الدرهم', en: 'Dirham' }, { ar: 'الجنيه', en: 'Pound' }], 1, { difficulty: 'MEDIUM' }),
      mcq('كم عدد الدول الأعضاء في جامعة الدول العربية؟', 'How many member states are in the Arab League?',
        [{ ar: '20', en: '20' }, { ar: '22', en: '22' }, { ar: '24', en: '24' }, { ar: '25', en: '25' }], 1, { difficulty: 'HARD' }),
      mcq('ما هي أقدم جامعة في العالم لا تزال تعمل؟', 'Which is the oldest continuously operating university?',
        [{ ar: 'القرويين', en: 'Al-Qarawiyyin' }, { ar: 'الأزهر', en: 'Al-Azhar' }, { ar: 'بولونيا', en: 'Bologna' }, { ar: 'أكسفورد', en: 'Oxford' }], 0, { difficulty: 'EXPERT' }),
    ],
  };

  // Create questions; collect ids in a stable order for the demo package.
  const createdQuestionIds: string[] = [];
  for (const [slug, questions] of Object.entries(questionsByCategory)) {
    const categoryId = categories[slug]!;
    for (const q of questions) {
      // Idempotency: a question is identified by (categoryId, promptAr).
      const existing = await prisma.question.findFirst({
        where: { categoryId, promptAr: q.promptAr },
        select: { id: true },
      });
      const data = {
        type: 'MULTIPLE_CHOICE' as const,
        difficulty: q.difficulty,
        categoryId,
        promptAr: q.promptAr,
        promptEn: q.promptEn,
        explanationAr: q.explanationAr,
        explanationEn: q.explanationEn,
        options: q.options,
        correctOptionId: q.correctOptionId,
        timeLimitSec: 15,
        basePoints: 100,
        speedBonus: true,
        isApproved: true,
      };
      const saved = existing
        ? await prisma.question.update({ where: { id: existing.id }, data })
        : await prisma.question.create({ data });
      createdQuestionIds.push(saved.id);
    }
  }
  console.log(`  ✓ questions: ${createdQuestionIds.length}`);

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
