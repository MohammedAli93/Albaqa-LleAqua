/**
 * Category-fit auditor.  Run:
 *   pnpm --filter @tahaddi/server exec tsx prisma/auditFit.ts            # summary
 *   pnpm --filter @tahaddi/server exec tsx prisma/auditFit.ts cinema-gulf # one category, full list
 *
 * Why this exists (client, 2026-08-07): the bank passed validateBank.ts — every
 * question was well-formed, non-leaking and unique — and was still embarrassing,
 * because well-formed says nothing about *belonging*. «شعارات وصور» was asking which
 * gland is the largest in the human body; «السينما والدراما الخليجية» was asking for
 * the biggest mall in Dubai. Picking a category is a promise to the player about what
 * they are about to be asked, and 23k questions is far past the size where that
 * promise can be kept by reading.
 *
 * The check, per category:
 *   • ANCHORS — words that mean "this text is plausibly about my subject". A question
 *     carrying none of its category's anchors is *unanchored*: it may still be a fine
 *     question, but nothing in it ties it to the category the player chose.
 *   • EXCLUDES — a hard boundary. Carrying one of these is a *misfile* no matter what
 *     else the question says, and the rule names the category it should move to.
 *   • BANNED — a soft hint. Same shape, but it only fires on a question that had no
 *     anchor of its own, because these markers are ordinary words a good question may
 *     borrow: «نجمة» belongs to space, yet «شعار سيارة بنجمة ثلاثية» is a logo question.
 *
 * Matching is substring-on-normalised-text (normalizeAr folds alef/ta-marbuta/hamza)
 * with the definite article stripped from the front of every word, so one anchor
 * «البرج» catches «البرج», «برج إيفل» and «بالبرج» alike. Broken plurals are still a
 * different stem — «فيلم» does not catch «أفلام» — so both forms are listed where both
 * occur; that verbosity is the price of not shipping a morphological analyser.
 *
 * Rules of the road:
 *   • Anchors are a net, not a judgement. Unanchored ≠ delete — it means *a human
 *     looks*. Keep them generous enough that a good question is rarely flagged.
 *   • CROSS_TOPIC categories are exempt from anchors by design: comparing a prophet to
 *     a footballer is the entire point of «ما المختلف؟».
 */
import { QUESTION_BANK } from './questionBank.js';
import { CATEGORIES, BANK_ALIASES } from './taxonomy.js';
import { normalizeAr } from './questionFilter.js';

interface Fit {
  /** At least one must appear in prompt+options for the question to be "anchored". */
  anchors?: string[];
  /**
   * Hard boundary: [markers, slug it belongs to]. A hit is a misfile even when the
   * question is anchored — Yemen is not a Gulf state however many Gulf words surround
   * it, and a mall is not a film however often «دبي» appears next to it.
   */
  excludes?: [string[], string][];
  /**
   * Soft hint: [markers, slug it belongs to]. Only fires on an *unanchored* question,
   * because these markers are ordinary words that a legitimate question may borrow —
   * «نجمة» belongs to space, but «شعار سيارة بنجمة ثلاثية» is a logo question.
   */
  banned?: [string[], string][];
  /**
   * Markers that cancel an `excludes` hit. A hard boundary still needs an escape for
   * the question that legitimately straddles it: «من الممثل السوري الذي انتقل للدراما
   * المصرية؟» is a Levant question that has to say مصر to be asked at all.
   */
  shield?: string[];
  /** Difficulties this category refuses (client: dialects are never EASY). */
  noDifficulty?: ('EASY' | 'MEDIUM' | 'HARD')[];
}

/** Shared marker sets, so a "this is really a football question" rule is written once. */
const M = {
  football: ['كره القدم', 'المنتخب', 'الدوري', 'هدف', 'اهداف', 'المرمي', 'اللاعب', 'لاعب',
             // NOT «البطولة»: in a drama bank it means "starring", and it was filing
             // «مسلسل من بطولة ناصر القصبي» as a football question.
             'الملعب', 'كاس العالم', 'المباراه', 'النادي', 'نادي', 'مدرب', 'حارس',
             'الفيفا', 'ريال مدريد', 'برشلونه', 'الهلال', 'النصر', 'الاتحاد', 'الاهلي'],
  religion: ['سوره', 'ايه', 'القران', 'الرسول', 'النبي', 'الصحابي', 'الصحابه', 'الخليفه',
             'الصلاه', 'الزكاه', 'الحج', 'الصيام', 'السنه النبويه', 'غزوه', 'الانبياء',
             'مسجد', 'الاسلام', 'المسلمين', 'الوحي', 'الهجره'],
  anatomy: ['جسم الانسان', 'العظمه', 'عظمه', 'الغده', 'العضله', 'الدم', 'القلب', 'الكبد',
            'الرئه', 'الدماغ', 'الكليه', 'الامعاء', 'المعده', 'الاعصاب', 'الهرمون',
            'فيتامين', 'المرض', 'الدواء', 'العلاج', 'الجراحه', 'اللقاح', 'الطبيب'],
  space: ['الفضاء', 'الكوكب', 'كوكب', 'المجره', 'النجم', 'القمر', 'الشمس', 'المريخ',
          'ناسا', 'الفلك', 'المذنب', 'الفضائي', 'رائد فضاء'],
  shopping: ['مركز تسوق', 'مركز التسوق', 'مول', 'المول', 'السوق', 'سوق', 'المتجر',
             'التسوق', 'المطعم', 'الفندق', 'البرج', 'ناطحه'],
  geographyPhys: ['القاره', 'المحيط', 'البحر', 'النهر', 'الجبل', 'الصحراء', 'الجزيره',
                  'البحيره', 'المضيق', 'خط الاستواء', 'الهضبه'],
} as const;

/** Categories that are cross-topic by design — no anchor requirement. */
const CROSS_TOPIC = new Set(['what-similar', 'what-different', 'general', 'weird-facts', 'puzzles-logic']);

const FIT: Record<string, Fit> = {
  // ── نكهة محلية ─────────────────────────────────────────────────────────────
  dialects: {
    anchors: ['لهجه', 'لهجات', 'تعني', 'معني', 'يقصد', 'المقصود', 'كلمه', 'مصطلح', 'تقول',
              'ينطق', 'يقول', 'عباره', 'التعبير', 'يستخدم', 'الخليجيه', 'خليجي', 'نجدي',
              'حجازي', 'كويتي', 'اماراتي', 'عماني', 'بحريني', 'قطري'],
    noDifficulty: ['EASY'],
  },
  'dialects-arab': {
    anchors: ['لهجه', 'لهجات', 'تعني', 'معني', 'يقصد', 'المقصود', 'كلمه', 'مصطلح', 'تقول',
              'ينطق', 'يقول', 'عباره', 'التعبير', 'يستخدم', 'مصري', 'شامي', 'سوري', 'لبناني',
              'مغربي', 'تونسي', 'جزائري', 'عراقي', 'سوداني', 'يمني', 'فلسطيني', 'اردني'],
    noDifficulty: ['EASY'],
  },
  vision2030: {
    anchors: ['رويه', '2030', 'نيوم', 'القديه', 'البحر الاحمر', 'الدرعيه', 'امالا', 'ذا لاين',
              'تروجينا', 'مشروع', 'مشاريع', 'صندوق الاستثمارات', 'السعوديه الخضراء', 'موسم',
              'الهيئه', 'هيئه', 'التحول', 'المستهدف', 'برنامج', 'الترفيه', 'السياحه',
              'التخصيص', 'جوده الحياه', 'الحج والعمره', 'اكسبو', 'كاس العالم 2034',
              'السعوديه', 'السعودي', 'ولي العهد', 'محمد بن سلمان', 'المملكه', 'القطاع',
              'الاصلاح', 'التوطين', 'الاستضافه', 'تستضيف', 'اطلق', 'اطلقت', 'الاستثمار',
              'العلا', 'الرياض', 'جده', 'الناتج', 'النفط', 'التنويع', 'المراه'],
  },
  heritage: {
    anchors: ['تراث', 'شعبي', 'شعبيه', 'قديم', 'قديمه', 'الباديه', 'بدوي', 'نجد', 'الحجاز',
              'عسير', 'الاجداد', 'حرفه', 'الحرف', 'الزي', 'الثوب', 'البشت', 'الشماغ', 'العقال',
              'القهوه', 'التمر', 'النخل', 'السدو', 'المجلس', 'العرضه', 'السامري', 'الفلكلور',
              'الاكله', 'الطبق', 'الماكولات', 'المندي', 'الكبسه', 'الجريش', 'المطبخ', 'العاده',
              'التقاليد', 'الموروث', 'الخيمه', 'الابل', 'الصقور', 'الصقاره', 'الدله', 'الفنجان',
              'المهرجان', 'الجنادريه', 'السعودي', 'السعوديه'],
    banned: [[[...M.football], 'football-gulf'], [[...M.space], 'space']],
  },
  'heritage-arab': {
    anchors: ['تراث', 'شعبي', 'شعبيه', 'قديم', 'قديمه', 'الاجداد', 'حرفه', 'الحرف', 'الزي',
              'العاده', 'التقاليد', 'الموروث', 'الاكله', 'الطبق', 'الماكولات', 'المطبخ',
              'الفلكلور', 'الرقصه', 'الدبكه', 'المهرجان', 'العربي', 'العربيه', 'مصري', 'مغربي',
              'شامي', 'عراقي', 'تونسي', 'جزائري', 'سوداني', 'يمني', 'ليبي', 'موريتاني'],
    banned: [[[...M.football], 'football-arab']],
  },
  nostalgia: {
    anchors: ['الثمانينات', 'التسعينات', 'الثمانينيات', 'التسعينيات', 'زمان', 'قديما', 'الماضي',
              'الطفوله', 'جيل', 'اتاري', 'الكاسيت', 'الفيديو', 'شريط', 'الاسطوانه', 'التلفزيون',
              'المذياع', 'الراديو', 'النوكيا', 'البيجر', 'الاتاري', 'سيجا', 'الالعاب القديمه',
              'الحاره', 'الحلوي', 'المدرسه', 'المجله', 'الكرتون', 'كان', 'كانت', 'قبل',
              'الاذاعه', 'الاذاعيه', 'الكاميرا', 'الصوره', 'الصور', 'الفيلم', 'الجهاز',
              'التقليدي', 'سابقا', 'الرقميه', 'البيوت', 'العائله', 'الطلبات', 'المستمعين'],
  },
  'saudi-landmarks': {
    anchors: ['السعوديه', 'السعودي', 'الرياض', 'جده', 'مكه', 'المدينه', 'الدمام', 'الخبر',
              'ابها', 'تبوك', 'حائل', 'القصيم', 'بريده', 'الطائف', 'نجران', 'جازان', 'الاحساء',
              'العلا', 'مدائن صالح', 'الدرعيه', 'ينبع', 'الجبيل', 'عرعر', 'سكاكا', 'الباحه',
              'برج', 'المملكه', 'منطقه', 'مدينه', 'محافظه', 'معلم', 'المعالم'],
  },
  'world-landmarks': {
    anchors: ['مدينه', 'المدينه', 'عاصمه', 'برج', 'معلم', 'المعالم', 'التمثال', 'تمثال',
              'القصر', 'المتحف', 'الكاتدرائيه', 'المعبد', 'الجسر', 'السور', 'الاهرام', 'الحديقه',
              'الساحه', 'الشارع', 'المبني', 'ناطحه', 'يقع', 'تقع', 'توجد', 'يوجد'],
  },

  // ── الرياضة ────────────────────────────────────────────────────────────────
  'world-cup': { anchors: ['كاس العالم', 'المونديال', ...M.football, 'استضاف', 'النسخه', 'التتويج'] },
  'football-europe': { anchors: [...M.football, 'اوروب', 'الابطال', 'اليوروبا', 'اليورو'] },
  'football-asia': { anchors: [...M.football, 'اسيا', 'الاسيوي', 'الاسيويه'] },
  'football-africa': { anchors: [...M.football, 'افريقي', 'الافريقيه', 'الامم الافريقيه'] },
  'football-southamerica': { anchors: [...M.football, 'اللاتيني', 'الجنوبيه', 'كوبا', 'البرازيل', 'الارجنتين', 'ليبرتادوريس'] },
  'football-arab': { anchors: [...M.football, 'العربي', 'العربيه', 'عربي'] },
  'football-gulf': { anchors: [...M.football, 'الخليج', 'الخليجي', 'خليجي'] },
  'saudi-league': { anchors: [...M.football, 'السعودي', 'السعوديه', 'روشن', 'المحترفين'] },
  'premier-league': { anchors: [...M.football, 'الانجليزي', 'البريميير', 'انجلترا', 'مانشستر', 'ليفربول', 'تشيلسي', 'ارسنال'] },
  laliga: { anchors: [...M.football, 'الاسباني', 'اسبانيا', 'الليجا', 'ريال', 'برشلونه', 'اتلتيكو'] },

  // ── الثقافة والمعرفة ───────────────────────────────────────────────────────
  'arab-world': {
    anchors: ['العربي', 'العربيه', 'عربي', 'عربيه', 'الجامعه العربيه', 'مصر', 'المغرب',
              'الجزائر', 'تونس', 'ليبيا', 'السودان', 'سوريا', 'لبنان', 'الاردن', 'فلسطين',
              'العراق', 'اليمن', 'موريتانيا', 'جيبوتي', 'الصومال', 'جزر القمر', 'الشام',
              'المغرب العربي', 'الخليج', 'السعوديه', 'الامارات', 'الكويت', 'قطر', 'البحرين', 'عمان'],
    banned: [[['صح', 'خطا'], 'general']],
  },
  gulf: {
    anchors: ['الخليج', 'الخليجي', 'خليجي', 'التعاون', 'السعوديه', 'السعودي', 'المملكه',
              'الامارات', 'الاماراتي', 'الكويت', 'الكويتي', 'قطر', 'القطري', 'البحرين',
              'البحريني', 'عمان', 'العماني', 'سلطنه عمان', 'الرياض', 'ابوظبي', 'دبي',
              'الدوحه', 'المنامه', 'مسقط', 'الطائف', 'الدمام', 'جده', 'مكه', 'نيوم',
              'الجزيره العربيه', 'رويه 2030'],
    // Yemen and Iraq are not GCC states — client, 2026-08-07.
    excludes: [[['اليمن', 'اليمني', 'اليمنيه', 'صنعاء', 'عدن', 'حضرموت', 'تعز'], 'arab-world'],
             [['العراق', 'العراقي', 'العراقيه', 'بغداد', 'البصره', 'الموصل', 'اربيل'], 'arab-world']],
  },
  history: { anchors: ['التاريخ', 'التاريخي', 'الحرب', 'المعركه', 'الدوله', 'الامبراطوريه', 'الملك', 'الملكه', 'الحضاره', 'القرن', 'الثوره', 'العصر', 'الاستقلال', 'المعاهده', 'الاحتلال', 'السلاله', 'تاسست', 'اندلعت', 'وقعت', 'عام', 'سنه', 'اول', 'الرئيس', 'القائد', 'الزعيم', 'المستكشف', 'اكتشف', 'وصل', 'سقط', 'انتهت', 'بدات', 'قديم', 'القدماء', 'الشعب', 'ابتكر', 'اغتيال', 'السفينه', 'الاسطول', 'المؤتمر', 'الاتفاقيه'] },
  'islamic-history': { anchors: [...M.religion, 'الدوله', 'الخلافه', 'الاسلاميه', 'الاندلس', 'العباسي', 'الاموي', 'العثماني', 'الفتح', 'المعركه', 'الحضاره'] },
  'military-history': { anchors: ['الجيش', 'العسكري', 'الحرب', 'المعركه', 'السلاح', 'الدبابه', 'المدفع', 'الاسطول', 'القائد', 'الرتبه', 'الجندي', 'القوات', 'الطائره الحربيه', 'البحريه', 'الحصار', 'التحالف', 'الغزو'] },
  geography: { anchors: [...M.geographyPhys, 'الدوله', 'دوله', 'العاصمه', 'المناخ', 'السكان', 'الحدود', 'المساحه', 'يقع', 'تقع', 'اكبر', 'اصغر', 'اطول', 'اعمق', 'خريطه'] },
  'flags-capitals': { anchors: ['العلم', 'علم', 'الاعلام', 'العاصمه', 'عاصمه', 'الوان', 'اللون', 'النجمه', 'الهلال', 'الشعار', 'الرايه'] },
  currencies: { anchors: ['العمله', 'عمله', 'الريال', 'الدينار', 'الدرهم', 'الجنيه', 'الدولار', 'اليورو', 'الليره', 'الين', 'الروبيه', 'البنك المركزي', 'الفئه', 'العملات'] },

  // ── الدين الإسلامي ─────────────────────────────────────────────────────────
  quran: { anchors: ['سوره', 'ايه', 'القران', 'المصحف', 'الجزء', 'التلاوه', 'التجويد', 'النزول', 'المكيه', 'المدنيه', 'السجده', 'الحزب'] },
  'prophets-companions': { anchors: [...M.religion, 'الرسل', 'الصحابيه', 'ابو بكر', 'عمر', 'عثمان', 'علي', 'الانصار', 'المهاجرين', 'ال بيت', 'ادم', 'نوح', 'ابراهيم', 'موسي', 'عيسي', 'يوسف', 'يونس', 'ايوب', 'سليمان', 'داوود', 'زكريا', 'يحيي', 'هود', 'صالح', 'لوط', 'شعيب', 'ادريس', 'الياس', 'اليسع', 'ذو الكفل', 'اسماعيل', 'اسحاق', 'يعقوب'] },

  // ── الدراما والفن ──────────────────────────────────────────────────────────
  'ramadan-drama': { anchors: ['رمضان', 'رمضاني', 'المسلسل', 'مسلسل', 'الحلقه', 'الدراما', 'الموسم', 'بطوله', 'الفوازير', 'المسحراتي', 'عرض'] },
  'movies-series': {
    anchors: ['فيلم', 'الفيلم', 'افلام', 'مسلسل', 'المسلسل', 'مسرحيه', 'المسرحيه', 'الممثل',
              'ممثله', 'الفنان', 'الفنانه', 'المخرج', 'السينما', 'الدراما', 'بطوله', 'دور',
              'شخصيه', 'الحلقه', 'المشهد', 'السيناريو', 'اخرج', 'جسد', 'قدم'],
    excludes: [[[...M.shopping], 'world-landmarks']],
    shield: ['مسلسل', 'فيلم', 'مسرحيه', 'الحلقه', 'احداثه', 'تدور', 'بطوله'],
  },
  'cinema-gulf': {
    anchors: ['فيلم', 'الفيلم', 'افلام', 'مسلسل', 'المسلسل', 'مسرحيه', 'المسرحيه', 'الممثل',
              'ممثله', 'الفنان', 'الفنانه', 'المخرج', 'السينما', 'الدراما', 'بطوله', 'دور',
              'شخصيه', 'الحلقه', 'المشهد', 'السيناريو', 'اخرج', 'جسد', 'قدم', 'المهرجان السينمائي'],
    excludes: [[[...M.shopping], 'world-landmarks']],
    shield: ['مسلسل', 'فيلم', 'مسرحيه', 'الحلقه', 'احداثه', 'تدور', 'بطوله'],
    banned: [[[...M.football], 'football-gulf']],
  },
  'cinema-levant': {
    anchors: ['فيلم', 'الفيلم', 'افلام', 'مسلسل', 'المسلسل', 'مسرحيه', 'المسرحيه', 'الممثل',
              'ممثله', 'الفنان', 'الفنانه', 'المخرج', 'السينما', 'الدراما', 'بطوله', 'دور',
              'شخصيه', 'الحلقه', 'المشهد', 'اخرج', 'جسد'],
    // Levant = Syria, Lebanon, Palestine, Jordan. Egyptian drama has its own bank.
    excludes: [[['مصري', 'مصريه', 'مصر', 'القاهره', 'الاسكندريه', 'الصعيد'], 'movies-series'],
               [[...M.shopping], 'world-landmarks']],
    shield: ['السوري', 'السوريه', 'اللبناني', 'اللبنانيه', 'الاردني', 'الاردنيه',
             'الفلسطيني', 'الفلسطينيه', 'الشامي', 'الشاميه', 'سوريا', 'لبنان',
             'الاردن', 'فلسطين', 'دمشق', 'بيروت'],
  },
  'anime-cartoon': { anchors: ['انمي', 'الانمي', 'الكرتون', 'كرتون', 'الرسوم', 'المتحركه', 'الشخصيه', 'المسلسل', 'ديزني', 'ستوديو', 'ياباني', 'المانجا', 'الحلقه', 'البطل', 'دبلجه', 'مدبلج'] },
  'art-gulf': {
    anchors: ['الفنان', 'الفنانه', 'المطرب', 'المطربه', 'الاغنيه', 'اغنيه', 'الالبوم', 'الحفله',
              'الملحن', 'الملحنه', 'الشاعر الغنائي', 'الموسيقي', 'العود', 'الطرب', 'اللحن',
              'غني', 'لحن', 'الصوت', 'الشيله', 'الفن', 'الفنون', 'الخط العربي', 'الزخرفه',
              'الارابيسك', 'تشكيلي', 'بينالي', 'النحت', 'الفسيفساء', 'المقام', 'الايقاع',
              'العرضه', 'السامري', 'المجرور', 'الفجري', 'الرزحه', 'العياله', 'اليوله', 'الدحه',
              'الليوا', 'النهمه', 'الاوبريت', 'المسرح', 'الرقص'],
    /**
     * Client 2026-09-01 — this category was the worst offender in their review, and
     * every example they gave (خبز الرقاق، اللباس الرجالي، الحي التاريخي في دبي، ورد
     * الطائف، مركز إثراء، جائزة الملك فيصل) slipped past the 2026-08-07 rule because
     * that rule only listed the words «تراث/حرفة/طبق/زي». So the boundary is drawn
     * around the SUBJECTS instead: what people eat, wear, ride, hunt with and play;
     * where they pray and shop; and what the region's book prizes are called.
     */
    excludes: [
      [['التراث', 'تراثي', 'الحرفه', 'الحرف', 'الاكله', 'الطبق', 'الماكولات', 'المطبخ',
        'الخبز', 'الحلوي', 'القهوه', 'البن', 'التمر', 'الزي', 'الثوب', 'البشت', 'الدشداشه',
        'الغتره', 'الشماغ', 'العقال', 'العبايه', 'البرقع', 'الحلي', 'الحليه', 'الكردان',
        'الخلخال', 'الحناء', 'السدو', 'الخيمه', 'الابل', 'الهجن', 'الصقر', 'الصقور',
        'الصقاره', 'الحباري', 'الخيل', 'الفروسيه', 'البلوت', 'الدامه', 'التيله', 'الكيرم',
        'الحجله', 'الديوانيه', 'الضيافه', 'الدله', 'الغوص', 'اللؤلؤ', 'العطر', 'البخور',
        'المسك', 'الخنجر'], 'heritage-arab'],
      [['مسجد', 'المسجد', 'الجامع', 'قلعه', 'القلعه', 'حصن', 'الحصن', 'الحي التاريخي',
        'سوق', 'السوق', 'جزيره', 'الجزيره'], 'gulf'],
      [['الجائزه', 'جائزه', 'الروايه', 'المجله', 'البوكر'], 'arabic-literature'],
      [['الورد الطائفي', 'منتج زراعي', 'سكه حديد', 'درب زبيده'], 'heritage'],
    ],
    // Real artist markers that let a legitimate question mention a souq or a mosque.
    shield: ['المطرب', 'المطربه', 'الاغنيه', 'الالبوم', 'الملحن', 'العزف', 'تشكيلي',
             'بينالي', 'الخط العربي', 'الزخرفه', 'النحت'],
  },
  artists: {
    anchors: ['الفنان', 'الفنانه', 'المطرب', 'المطربه', 'الاغنيه', 'الالبوم', 'الحفله',
              'الملحن', 'الموسيقي', 'الموسيقيه', 'الرسام', 'اللوحه', 'النحات', 'المسرح',
              'الممثل', 'الممثله', 'الجائزه', 'غرامي', 'اوسكار', 'غني', 'لحن', 'رسم',
              'العزف', 'عازف', 'الاله', 'العود', 'الطرب', 'المقام', 'الصوت', 'الفرقه',
              'المغني', 'المغنيه', 'الاوبرا', 'الباليه', 'الرقص', 'المعرض', 'الاعمال'],
    /**
     * Client 2026-09-01 — «ظهور سؤال عن النشيد الوطني / متحف برادو / مهرجان جرش ضمن
     * فئة فنانون عرب وأجانب». The category is about PEOPLE and their work; a building,
     * a festival or an anthem is not an artist however artistic its subject. The
     * shield keeps the questions that name a work — «في أي متحف تُعرض لوحة الموناليزا؟»
     * is a painting question that has to say «متحف» to be asked at all.
     */
    excludes: [
      [['النشيد الوطني'], 'general'],
      [['المتحف', 'متحف'], 'world-landmarks'],
      [['مهرجان جرش', 'مهرجانات بعلبك', 'مهرجان قرطاج', 'موازين', 'مهرجان الجنادريه'], 'arab-world'],
      [['رائد فضاء', 'رواد الفضاء', 'محطه الفضاء'], 'space'],
      [['العالم المسلم', 'الطبيب المسلم', 'نوبل في الكيمياء', 'نوبل في الفيزياء',
        'الدوره الدمويه', 'البصريات', 'علم الجبر'], 'scientists-inventors'],
      [[...M.football], 'football-arab'],
    ],
    shield: ['اللوحه', 'الرسام', 'التمثال', 'النحات', 'المقتنيات', 'رسمها', 'نحتها', 'المعماري', 'المصمم'],
    // Poets belong to «الشعر» — a poem set to music is still a poetry question.
    banned: [[['الشاعر', 'الشاعره', 'الشعراء', 'القصيده', 'الشعر الحر', 'الديوان'], 'poetry']],
  },

  // ── الترفيه ────────────────────────────────────────────────────────────────
  'video-games': { anchors: ['لعبه', 'اللعبه', 'الالعاب', 'بلايستيشن', 'اكس بوكس', 'نينتندو', 'الكونسول', 'المطور', 'الاصدار', 'الشخصيه', 'اللاعب', 'الجزء', 'الاونلاين', 'ستيم', 'سوني', 'مايكروسوفت'] },
  'social-celebs': {
    anchors: ['صانع المحتوي', 'المحتوي', 'اليوتيوبر', 'يوتيوبر', 'المشهور', 'المشاهير', 'مشهور',
              'البودكاست', 'بودكاست', 'البرنامج', 'القناه', 'المتابعين', 'متابع', 'انستغرام',
              'انستقرام', 'سناب', 'تيك توك', 'يوتيوب', 'تويتر', 'اكس', 'المؤثر', 'مؤثر',
              'الستريمر', 'البث', 'اشتهر', 'يشتهر', 'اسم', 'الملقب', 'مقدم'],
  },
  guess: {
    // Every question here is an identify-from-a-cue prompt: the prompt describes a
    // thing and the player names it. The game shows no images, so the cue is written
    // — «حيوان بخرطوم طويل وأذنين كبيرتين — ما هو؟» — and that em-dash-then-question
    // shape is the category's own format, which is why it anchors here.
    anchors: ['شعار', 'شعارها', 'شعاره', 'صوره', 'الصوره', 'يظهر', 'تظهر', 'رمز', 'الرمز',
              'العلم', 'علم', 'اللوجو', 'الايقونه', 'الشكل', 'اللون', 'الوان', 'المعلم',
              'التمثال', 'تمثال', 'البرج', 'المبني', 'الشخصيه', 'الملصق', 'الغلاف', 'خمن',
              '—', 'اي شركه', 'اي ماركه', 'اي علامه', 'اي مدينه', 'اي دوله', 'اي منصه',
              'اي تطبيق', 'اي شخصيه', 'اي بطل', 'اي مطعم', 'اي سياره', 'اي فريق'],
    // Anatomy and physical geography are the two that actually went wrong here — the
    // client's screenshot was «أكبر غدة في جسم الإنسان» sitting in a logo category.
    excludes: [[[...M.anatomy], 'medicine-health']],
    banned: [[[...M.space], 'space'], [[...M.geographyPhys], 'geography'],
             [[...M.religion], 'prophets-companions']],
  },
  'world-wonders': { anchors: ['عجائب', 'الاعجوبه', 'الاهرام', 'الهرم', 'سور الصين', 'البتراء', 'بترا', 'تاج محل', 'الكولوسيوم', 'ماتشو', 'المسيح الفادي', 'المعلم', 'الاثر', 'الاثريه', 'المعبد', 'الحدائق المعلقه', 'المناره', 'التمثال', 'الضريح', 'البرج', 'المبني', 'القلعه', 'القصر', 'الصرح', 'المدينه', 'يقع', 'تقع', 'بني', 'شيد', 'الحضاره', 'الاسوار', 'الكنيسه', 'الكاتدرائيه', 'المسجد', 'الجامع', 'الساعه', 'دار الاوبرا', 'السد', 'النصب'] },

  // ── العلوم والتقنية ────────────────────────────────────────────────────────
  'medicine-health': { anchors: [...M.anatomy, 'الصحه', 'صحي', 'التغذيه', 'المناعه', 'الفيروس', 'البكتيريا', 'المستشفي', 'التشخيص', 'الاعراض'] },
  science: { anchors: ['العنصر', 'المركب', 'الذره', 'الجزيء', 'التفاعل', 'الكيمياء', 'الفيزياء', 'الاحياء', 'الطاقه', 'القوه', 'السرعه', 'الحراره', 'الضوء', 'الصوت', 'الجاذبيه', 'الكهرباء', 'المغناطيس', 'الخليه', 'النبات', 'الحيوان', 'الحمض', 'المعادله', 'الغاز', 'السائل', 'الكثافه', 'النظريه', 'القانون', 'الماده', 'الماء', 'الاكسجين', 'الكربون', 'المعدن', 'الرمز', 'الوحده', 'القياس', 'درجه', 'التنفس', 'الجسم', 'العضو', 'الدم', 'الفيتامين', 'الطبيعه', 'الكواكب', 'المجموعه الشمسيه', 'الطيور', 'الاسماك', 'الحشرات', 'الثدييات', 'الزواحف', 'البروتين', 'الطفره', 'الجينات', 'النووي'] },
  space: { anchors: [...M.space, 'المدار', 'المجموعه الشمسيه', 'الثقب الاسود', 'التلسكوب', 'المكوك', 'القمر الصناعي', 'الكون', 'الضوئيه', 'الكسوف', 'الخسوف'] },
  tech: { anchors: ['التقنيه', 'التكنولوجيا', 'الحاسوب', 'الكمبيوتر', 'الجوال', 'الهاتف', 'البرمجه', 'البرنامج', 'النظام', 'الشريحه', 'المعالج', 'الذاكره', 'الشبكه', 'البيانات', 'التشفير', 'الشركه', 'الجهاز', 'الاصدار', 'الشاشه', 'البطاريه', 'الروبوت', 'اختصار'] },
  ai: { anchors: ['الذكاء الاصطناعي', 'الذكاء', 'التعلم', 'الاله', 'الخوارزميه', 'النموذج', 'الشبكه العصبيه', 'البيانات', 'التدريب', 'المساعد', 'شات', 'روبوت', 'التوليدي', 'التعرف', 'المعالجه'] },
  'internet-apps': {
    anchors: ['الانترنت', 'التطبيق', 'تطبيق', 'الموقع', 'موقع', 'المنصه', 'منصه', 'المتصفح',
              'البريد', 'الايميل', 'الرابط', 'النطاق', 'السحابه', 'التحميل', 'الشبكه',
              'التواصل الاجتماعي', 'الحساب', 'كلمه المرور', 'الرمز', 'الايقونه', 'الاشتراك',
              'يوتيوب', 'واتساب', 'انستغرام', 'انستقرام', 'سناب', 'تيك توك', 'تويتر', 'فيسبوك',
              'تيليجرام', 'جوجل', 'نتفليكس', 'اطلق', 'تاسس', 'اشتري', 'المؤسس', 'الشركه'],
    // A question about a *person* who is famous online is a celebrity question; a
    // question about the platform, the format or the business model is not. So the
    // markers name people, and deliberately exclude «المؤثر»/«المشاهير» on their own —
    // "what is influencer marketing called" is an internet question that happens to
    // say المؤثر. «الرياضي» is out too: it prefix-matches الرياضيات and الرياضية.
    excludes: [[['صانع المحتوي', 'صانعه المحتوي', 'اليوتيوبر', 'يوتيوبر', 'الشيف',
               'مؤثر خليجي', 'مؤثره عربيه', 'مؤثر عربي', 'المؤثر السعودي',
               'جنسيه'], 'social-celebs']],
  },
  economy: { anchors: ['الاقتصاد', 'الاقتصادي', 'الشركه', 'شركه', 'السوق', 'البورصه', 'السهم', 'الاستثمار', 'الارباح', 'الناتج', 'التضخم', 'البنك', 'التجاره', 'الصادرات', 'الواردات', 'الميزانيه', 'الضريبه', 'النفط', 'العمله', 'الثروه', 'المليارد', 'العلامه التجاريه'] },
  'scientists-inventors': { anchors: ['العالم', 'عالم', 'المخترع', 'مخترع', 'اخترع', 'اكتشف', 'الاكتشاف', 'الاختراع', 'النظريه', 'الجائزه', 'نوبل', 'الطبيب', 'الفيلسوف', 'الرياضيات', 'العلماء'] },
  inventions: { anchors: ['اخترع', 'المخترع', 'الاختراع', 'اخترعت', 'اكتشف', 'الاكتشاف', 'ابتكر', 'الابتكار', 'اول', 'صنع', 'ظهر', 'البراءه', 'الجهاز', 'الاله'] },

  // ── اللغة والثقافة ─────────────────────────────────────────────────────────
  'arabic-literature': { anchors: ['اللغه', 'العربيه', 'النحو', 'الصرف', 'البلاغه', 'الكتاب', 'الروايه', 'الاديب', 'الكاتب', 'المؤلف', 'الحرف', 'الكلمه', 'الجمع', 'المفرد', 'الفعل', 'الاسم', 'المعني', 'المرادف', 'الجائزه', 'الادب', 'الشعر', 'الشاعر', 'الشعراء', 'القصيده', 'المعلقات', 'الموشحات', 'المعجم', 'الضد', 'المؤنث', 'المذكر', 'الجمله', 'الاعراب', 'العصر', 'الف', 'كتب', 'سمي', 'يلقب', 'الملقب', 'صاحب', 'ديوان', 'قصه', 'مسرحيه', 'النثر', 'المقامات'] },
  poetry: { anchors: ['الشعر', 'الشاعر', 'شاعر', 'القصيده', 'قصيده', 'البيت', 'المعلقات', 'البحر', 'القافيه', 'الديوان', 'النبطي', 'ابيات', 'انشد', 'قال', 'الشعراء'] },
  proverbs: { anchors: ['المثل', 'مثل', 'الامثال', 'الحكمه', 'حكمه', 'المقوله', 'يقال', 'يضرب', 'القول', 'العباره', 'تكمله', 'يكمل'] },

  // ── السيارات والطيران ──────────────────────────────────────────────────────
  cars: { anchors: ['السياره', 'سياره', 'السيارات', 'المحرك', 'الاطار', 'العجله', 'الشركه', 'الماركه', 'الموديل', 'السرعه', 'الوقود', 'الكهربائيه', 'الفئه', 'الشعار', 'القياده', 'السائق', 'الفورمولا', 'السباق'] },
  aviation: { anchors: ['الطيران', 'الطائره', 'طائره', 'المطار', 'الطيار', 'الرحله', 'الشركه', 'المضيف', 'الاقلاع', 'الهبوط', 'المدرج', 'الجناح', 'المحرك', 'الارتفاع', 'المروحيه', 'الاجواء', 'الخطوط'] },
};

/**
 * Normalise for marker matching: normalizeAr, then drop the definite article from the
 * start of every word — including after a one-letter proclitic, so «بالعود» folds to
 * «بعود». Arabic glues «ال» onto nouns freely; without this an anchor has to be
 * written twice (البرج / برج) to catch the same word in two positions.
 */
const fold = (s: string): string => ` ${normalizeAr(s).replace(/(^|\s)([وبلفك]?)ال/g, '$1$2')} `;

/**
 * Does `text` (already folded) contain `marker` as the start of a word?
 *
 * Prefix-anchored rather than free substring: «المعدنية» folds to «معدنيه», which
 * *contains* «عدن» and had the Saudi-riyal-subunit question filed as a question about
 * Aden. Suffixes stay free so one marker «يمن» still catches «يمني/اليمنية», and a
 * single proclitic (و ب ل ف ك) is allowed in front.
 */
const hasMarker = (text: string, marker: string): boolean => {
  const m = fold(marker).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The tail must be a word end or an Arabic inflectional suffix. Without it,
  // «دوائر» (circles) — which normalises to «دواءر» — matched the marker «الدواء»
  // and filed the Spotify-logo question under medicine.
  return new RegExp(`(?:^|\\s)[وبلفك]?${m}(?:[هايينتماكو]*)(?:\\s|$)`).test(text);
};

const arg = process.argv[2];
const rows: { slug: string; nameAr: string; total: number; unanchored: number; misfiled: number; badDiff: number }[] = [];
const detail: string[] = [];

for (const cat of CATEGORIES) {
  const fit = FIT[cat.slug];
  const questions = QUESTION_BANK[cat.slug] ?? [];
  let unanchored = 0;
  let misfiled = 0;
  let badDiff = 0;

  for (const q of questions) {
    const text = fold(`${q.ar} ${q.o.join(' ')}`);
    const hasAnchor = !fit?.anchors || fit.anchors.some((a) => hasMarker(text, a));
    // Banned markers are matched against the PROMPT only. What a question is *about*
    // is what it asks; a country named among the distractors is scenery. "مع أي دولتين
    // تشترك الكويت في حدودها؟ ✓ العراق والسعودية" is a Gulf question that happens to
    // say العراق, and flagging it would train us to delete good questions.
    const promptText = fold(q.ar);

    if (fit?.noDifficulty?.includes(q.d ?? 'MEDIUM')) {
      badDiff++;
      if (arg === cat.slug) detail.push(`  [difficulty ${q.d}] ${q.ar}`);
    }

    // A misfile is stronger than "unanchored": it names where the question belongs.
    // Hard boundaries apply always; soft hints only to questions that had no anchor
    // of their own to begin with.
    let moved = false;
    const shielded = fit?.shield?.some((w) => hasMarker(promptText, w)) ?? false;
    const rules = [
      ...(shielded ? [] : (fit?.excludes ?? [])),
      ...(hasAnchor ? [] : (fit?.banned ?? [])),
    ];
    for (const [words, goes] of rules) {
      if (words.some((w) => hasMarker(promptText, w))) {
        misfiled++;
        moved = true;
        if (arg === cat.slug) detail.push(`  [→ ${goes}] ${q.ar}`);
        break;
      }
    }
    if (!moved && !hasAnchor && !CROSS_TOPIC.has(cat.slug)) {
      unanchored++;
      if (arg === cat.slug) detail.push(`  [unanchored] ${q.ar}  →  ${q.o[q.c]}`);
    }
  }

  rows.push({ slug: cat.slug, nameAr: cat.nameAr, total: questions.length, unanchored, misfiled, badDiff });
}

if (arg && arg !== '--all') {
  const row = rows.find((r) => r.slug === arg);
  if (!row) {
    console.log(`No such category: ${arg}`);
    process.exit(1);
  }
  console.log(`${row.nameAr} (${row.slug}) — ${row.total} questions`);
  console.log(`  ${row.misfiled} misfiled · ${row.unanchored} unanchored · ${row.badDiff} wrong difficulty\n`);
  for (const d of detail) console.log(d);
  process.exit(0);
}

const orphans = Object.keys(QUESTION_BANK).filter(
  (k) => !CATEGORIES.some((c) => c.slug === (BANK_ALIASES[k] ?? k)),
);
if (orphans.length) console.log(`⚠️  bank keys mapping to no live category: ${orphans.join(', ')}\n`);

rows.sort((a, b) => b.misfiled + b.unanchored + b.badDiff - (a.misfiled + a.unanchored + a.badDiff));
const totals = rows.reduce(
  (t, r) => ({ q: t.q + r.total, m: t.m + r.misfiled, u: t.u + r.unanchored, d: t.d + r.badDiff }),
  { q: 0, m: 0, u: 0, d: 0 },
);
console.log(`${totals.q} questions · ${totals.m} misfiled · ${totals.u} unanchored · ${totals.d} wrong difficulty\n`);
console.log('  misfiled  unanchored  difficulty   total   category');
for (const r of rows) {
  if (!r.misfiled && !r.unanchored && !r.badDiff) continue;
  console.log(
    `  ${String(r.misfiled).padStart(8)}  ${String(r.unanchored).padStart(10)}  ${String(r.badDiff).padStart(10)}   ${String(r.total).padStart(5)}   ${r.slug.padEnd(22)} ${r.nameAr}`,
  );
}
const clean = rows.filter((r) => !r.misfiled && !r.unanchored && !r.badDiff);
if (clean.length) console.log(`\n✅ clean: ${clean.map((r) => r.slug).join(', ')}`);
