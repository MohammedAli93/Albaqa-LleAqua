/**
 * The category taxonomy: groups (فئات رئيسية) → categories (فئات فرعية).
 * Single source of truth for the seed and the grouped category picker.
 *
 * Revision 2026-08-05 — rebuilt from the client's list. Ten groups, in the order
 * the client asked for:
 *   1. المتشابه والمختلف   2. نكهة محلية   3. الرياضة (كرة القدم)
 * …then the rest ordered by how much play they get: general knowledge, religion,
 * drama & art, entertainment, science & tech, language, then cars & aviation.
 *
 * Rules of the road:
 *   • `slug` is a permanent id — the question bank and every seeded question join
 *     on it. Renaming a nameAr is safe; renaming a slug orphans the questions.
 *   • Array order IS the display order (the seed writes it into `sortOrder`).
 *   • A category the owner reorders/renames in the admin panel keeps their version
 *     (see `adminEdited` / `sortEdited` in schema.prisma).
 */

export interface GroupDef {
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  icon: string; // lucide icon name (used by the picker group header)
}

export interface CategoryDef {
  slug: string;
  nameAr: string;
  nameEn: string;
  group: string; // GroupDef.slug
}

export const GROUPS: GroupDef[] = [
  { slug: 'similar-different', nameAr: 'المتشابه والمختلف', nameEn: 'Similar & Different', color: '#F97316', icon: 'git-compare' },
  { slug: 'local-flavor', nameAr: 'نكهة محلية', nameEn: 'Local Flavor', color: '#F59E0B', icon: 'sparkles' },
  { slug: 'sports', nameAr: 'الرياضة', nameEn: 'Sports', color: '#EF4444', icon: 'trophy' },
  { slug: 'culture-knowledge', nameAr: 'الثقافة والمعرفة', nameEn: 'Culture & Knowledge', color: '#7C3AED', icon: 'book-open' },
  { slug: 'religion', nameAr: 'الدين الإسلامي', nameEn: 'Islam', color: '#16A34A', icon: 'moon' },
  { slug: 'drama-art', nameAr: 'الدراما والفن', nameEn: 'Drama & Art', color: '#EC4899', icon: 'clapperboard' },
  { slug: 'entertainment', nameAr: 'الترفيه', nameEn: 'Entertainment', color: '#A855F7', icon: 'party-popper' },
  { slug: 'science-tech', nameAr: 'العلوم والتقنية', nameEn: 'Science & Technology', color: '#06B6D4', icon: 'flask-conical' },
  { slug: 'language-culture', nameAr: 'اللغة والثقافة', nameEn: 'Language & Culture', color: '#0EA371', icon: 'languages' },
  { slug: 'transport', nameAr: 'السيارات والطيران', nameEn: 'Cars & Aviation', color: '#0EA5E9', icon: 'car' },
];

export const CATEGORIES: CategoryDef[] = [
  // ── ١) المتشابه والمختلف ──
  { slug: 'what-similar', nameAr: 'ما المتشابه؟', nameEn: 'What is similar?', group: 'similar-different' },
  { slug: 'what-different', nameAr: 'ما المختلف؟', nameEn: 'What is different?', group: 'similar-different' },

  // ── ٢) نكهة محلية ──
  { slug: 'dialects', nameAr: 'اللهجات الخليجية', nameEn: 'Gulf Dialects', group: 'local-flavor' },
  { slug: 'dialects-arab', nameAr: 'اللهجات العربية', nameEn: 'Arab Dialects', group: 'local-flavor' },
  { slug: 'vision2030', nameAr: 'رؤية 2030', nameEn: 'Vision 2030', group: 'local-flavor' },
  { slug: 'heritage', nameAr: 'التراث السعودي', nameEn: 'Saudi Heritage', group: 'local-flavor' },
  { slug: 'heritage-arab', nameAr: 'التراث العربي', nameEn: 'Arab Heritage', group: 'local-flavor' },
  { slug: 'nostalgia', nameAr: 'نوستالجيا التسعينات والثمانينات', nameEn: '80s & 90s Nostalgia', group: 'local-flavor' },
  { slug: 'saudi-landmarks', nameAr: 'معالم ومدن المملكة', nameEn: 'Saudi Landmarks & Cities', group: 'local-flavor' },
  { slug: 'world-landmarks', nameAr: 'معالم ومدن العالم', nameEn: 'World Landmarks & Cities', group: 'local-flavor' },

  // ── ٣) الرياضة ──
  { slug: 'world-cup', nameAr: 'كأس العالم', nameEn: 'World Cup', group: 'sports' },
  { slug: 'football-europe', nameAr: 'كرة القدم الأوروبية', nameEn: 'European Football', group: 'sports' },
  { slug: 'football-asia', nameAr: 'كرة القدم الآسيوية', nameEn: 'Asian Football', group: 'sports' },
  { slug: 'football-africa', nameAr: 'كرة القدم الأفريقية', nameEn: 'African Football', group: 'sports' },
  { slug: 'football-southamerica', nameAr: 'كرة القدم الأمريكية الجنوبية', nameEn: 'South American Football', group: 'sports' },
  { slug: 'football-arab', nameAr: 'كرة القدم العربية', nameEn: 'Arab Football', group: 'sports' },
  { slug: 'football-gulf', nameAr: 'كرة القدم الخليجية', nameEn: 'Gulf Football', group: 'sports' },
  { slug: 'saudi-league', nameAr: 'الدوري السعودي', nameEn: 'Saudi League', group: 'sports' },
  { slug: 'premier-league', nameAr: 'الدوري الإنجليزي', nameEn: 'Premier League', group: 'sports' },
  { slug: 'laliga', nameAr: 'الدوري الإسباني', nameEn: 'La Liga', group: 'sports' },

  // ── ٤) الثقافة والمعرفة ──
  { slug: 'general', nameAr: 'الثقافة العامة', nameEn: 'General Culture', group: 'culture-knowledge' },
  { slug: 'arab-world', nameAr: 'العالم العربي', nameEn: 'Arab World', group: 'culture-knowledge' },
  { slug: 'gulf', nameAr: 'الخليج العربي', nameEn: 'The Arabian Gulf', group: 'culture-knowledge' },
  { slug: 'history', nameAr: 'التاريخ', nameEn: 'History', group: 'culture-knowledge' },
  { slug: 'islamic-history', nameAr: 'التاريخ الإسلامي', nameEn: 'Islamic History', group: 'culture-knowledge' },
  { slug: 'military-history', nameAr: 'الجيش والتاريخ العسكري', nameEn: 'Army & Military History', group: 'culture-knowledge' },
  { slug: 'geography', nameAr: 'الجغرافيا', nameEn: 'Geography', group: 'culture-knowledge' },
  { slug: 'flags-capitals', nameAr: 'الأعلام والعواصم', nameEn: 'Flags & Capitals', group: 'culture-knowledge' },
  { slug: 'currencies', nameAr: 'العملات', nameEn: 'Currencies', group: 'culture-knowledge' },

  // ── ٥) الدين الإسلامي ──
  { slug: 'quran', nameAr: 'القرآن الكريم', nameEn: 'The Holy Quran', group: 'religion' },
  { slug: 'islamic-culture', nameAr: 'الثقافة الإسلامية', nameEn: 'Islamic Culture', group: 'religion' },
  { slug: 'seerah', nameAr: 'السيرة النبوية', nameEn: "The Prophet's Biography", group: 'religion' },
  { slug: 'prophets-companions', nameAr: 'الأنبياء والصحابة', nameEn: 'Prophets & Companions', group: 'religion' },

  // ── ٦) الدراما والفن ──
  { slug: 'ramadan-drama', nameAr: 'رمضان والدراما الرمضانية', nameEn: 'Ramadan & Its Drama', group: 'drama-art' },
  { slug: 'movies-series', nameAr: 'السينما والدراما العربية', nameEn: 'Arab Cinema & Drama', group: 'drama-art' },
  { slug: 'cinema-gulf', nameAr: 'السينما والدراما الخليجية', nameEn: 'Gulf Cinema & Drama', group: 'drama-art' },
  { slug: 'cinema-levant', nameAr: 'السينما والدراما الشامية', nameEn: 'Levantine Cinema & Drama', group: 'drama-art' },
  { slug: 'anime-cartoon', nameAr: 'الأنمي والكرتون', nameEn: 'Anime & Cartoons', group: 'drama-art' },
  { slug: 'art-gulf', nameAr: 'الفن الخليجي', nameEn: 'Gulf Art & Music', group: 'drama-art' },
  { slug: 'artists', nameAr: 'فنانون عرب وأجانب', nameEn: 'Arab & Foreign Artists', group: 'drama-art' },

  // ── ٧) الترفيه ──
  { slug: 'video-games', nameAr: 'الألعاب الإلكترونية', nameEn: 'Video Games', group: 'entertainment' },
  // Slug kept for continuity; renamed 2026-08-07 — the client asked for a category about
  // social-media celebrities (creators, streamers, podcasters), not artists or TV people
  // and not platform trivia (that lives in internet-apps). See bank/social-celebs.ts.
  { slug: 'social-celebs', nameAr: 'مشاهير السوشل ميديا', nameEn: 'Social-Media Celebrities', group: 'entertainment' },
  { slug: 'guess', nameAr: 'خمّن (شعارات وصور)', nameEn: 'Guess (logos & pictures)', group: 'entertainment' },
  { slug: 'world-wonders', nameAr: 'عجائب العالم', nameEn: 'World Wonders', group: 'entertainment' },
  { slug: 'weird-facts', nameAr: 'حقائق غريبة', nameEn: 'Weird Facts', group: 'entertainment' },
  { slug: 'puzzles-logic', nameAr: 'ألغاز ومنطق', nameEn: 'Puzzles & Logic', group: 'entertainment' },

  // ── ٨) العلوم والتقنية ──
  { slug: 'medicine-health', nameAr: 'الطب والصحة', nameEn: 'Medicine & Health', group: 'science-tech' },
  { slug: 'science', nameAr: 'العلوم', nameEn: 'Science', group: 'science-tech' },
  { slug: 'space', nameAr: 'الفضاء', nameEn: 'Space', group: 'science-tech' },
  { slug: 'tech', nameAr: 'التقنية', nameEn: 'Technology', group: 'science-tech' },
  { slug: 'ai', nameAr: 'الذكاء الاصطناعي', nameEn: 'Artificial Intelligence', group: 'science-tech' },
  { slug: 'internet-apps', nameAr: 'الإنترنت والتطبيقات', nameEn: 'Internet & Apps', group: 'science-tech' },
  { slug: 'economy', nameAr: 'الاقتصاد والأعمال', nameEn: 'Economy & Business', group: 'science-tech' },
  { slug: 'scientists-inventors', nameAr: 'علماء ومخترعون', nameEn: 'Scientists & Inventors', group: 'science-tech' },
  { slug: 'inventions', nameAr: 'الاختراعات والاكتشافات', nameEn: 'Inventions & Discoveries', group: 'science-tech' },

  // ── ٩) اللغة والثقافة ──
  { slug: 'arabic-literature', nameAr: 'الأدب واللغة العربية', nameEn: 'Arabic Literature & Language', group: 'language-culture' },
  { slug: 'poetry', nameAr: 'الشعر', nameEn: 'Poetry', group: 'language-culture' },
  { slug: 'proverbs', nameAr: 'الأمثال والحكم', nameEn: 'Proverbs & Sayings', group: 'language-culture' },

  // ── ١٠) السيارات والطيران ──
  { slug: 'cars', nameAr: 'السيارات', nameEn: 'Cars', group: 'transport' },
  { slug: 'aviation', nameAr: 'الطيران', nameEn: 'Aviation', group: 'transport' },
];

/**
 * Bank key → category slug, for content whose category was folded into another one
 * by the 2026-08-05 restructure. The question bank keeps its original (fine-grained)
 * keys so the content stays organised by topic; the seed resolves each key through
 * this map before writing, which is what keeps ~1,400 already-written questions live
 * instead of retiring them with their old category.
 *
 * e.g. the 18 per-country banks now feed «العالم العربي» / «الخليج العربي».
 */
export const BANK_ALIASES: Record<string, string> = {
  // per-country banks → الخليج العربي / العالم العربي
  saudi: 'gulf',
  'country-kuwait': 'gulf',
  'country-bahrain': 'gulf',
  'country-qatar': 'gulf',
  'country-uae': 'gulf',
  'country-oman': 'gulf',
  'country-yemen': 'gulf',
  'country-iraq': 'arab-world',
  'country-syria': 'arab-world',
  'country-palestine': 'arab-world',
  'country-jordan': 'arab-world',
  'country-lebanon': 'arab-world',
  'country-egypt': 'arab-world',
  'country-sudan': 'arab-world',
  'country-libya': 'arab-world',
  'country-tunisia': 'arab-world',
  'country-algeria': 'arab-world',
  'country-morocco': 'arab-world',
  'country-mauritania': 'arab-world',

  // football: continent/competition banks → the new continental categories
  'football-world': 'football-europe',
  'asian-cup': 'football-asia',
  'africa-cup': 'football-africa',
  'arab-cup': 'football-arab',
  'egypt-league': 'football-arab',
  'football-morocco': 'football-arab',
  'gulf-cup': 'football-gulf',
  sports: 'world-cup', // the general-sports bank is mostly tournament trivia

  // art & cinema: the regional art banks → «فنانون عرب وأجانب»
  celebrities: 'artists',
  'art-music': 'artists',
  'art-levant': 'artists',
  'art-iraq': 'artists',
  'cinema-iraq': 'movies-series',

  // science & general
  'muslim-scientists': 'scientists-inventors',
  animals: 'science',
  nature: 'science',
  food: 'general',
  'true-false': 'general',
};

/**
 * Categories the restructure dropped. The seed soft-deletes exactly these (an
 * explicit list, so a category the owner added by hand in the panel is never
 * touched). Their questions live on under the category BANK_ALIASES points to.
 */
export const RETIRED_CATEGORY_SLUGS: string[] = Object.keys(BANK_ALIASES);

/** Groups the restructure emptied — deleted by the seed once nothing points at them. */
export const RETIRED_GROUP_SLUGS: string[] = ['arab-countries', 'life-nature', 'misc-knowledge'];

/**
 * Target bank size per category. The client's brief said 500 («بنك اسئلة يحتوي على
 * ٥٠٠ سؤال»); the owner lowered it to 350 to get every category to a playable depth
 * sooner. Raise it back when the banks are levelled — nothing caps a category here,
 * the number only sets what "done" means for the progress view and the admin panel.
 */
export const TARGET_BANK_SIZE = 350;
