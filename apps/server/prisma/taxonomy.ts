/**
 * The category taxonomy: groups → categories. Single source of truth for the
 * seed and the grouped category picker. Slugs are stable identifiers; renaming a
 * nameAr is safe (questions link by category id, not name).
 *
 * Built from the client's revision list plus a curated set of Gulf/Saudi-friendly
 * additions (the "نكهة محلية" group, plus muslim-scientists / guess / true-false).
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
  { slug: 'culture-knowledge', nameAr: 'الثقافة والمعرفة', nameEn: 'Culture & Knowledge', color: '#7C3AED', icon: 'book-open' },
  { slug: 'arab-countries', nameAr: 'الدول العربية', nameEn: 'Arab Countries', color: '#0EA371', icon: 'flag' },
  { slug: 'religion', nameAr: 'الدين الإسلامي', nameEn: 'Islam', color: '#16A34A', icon: 'moon' },
  { slug: 'sports', nameAr: 'الرياضة', nameEn: 'Sports', color: '#EF4444', icon: 'trophy' },
  { slug: 'science-tech', nameAr: 'العلوم والتقنية', nameEn: 'Science & Technology', color: '#06B6D4', icon: 'flask-conical' },
  { slug: 'transport', nameAr: 'النقل والمركبات', nameEn: 'Transport & Vehicles', color: '#0EA5E9', icon: 'car' },
  { slug: 'entertainment', nameAr: 'الترفيه', nameEn: 'Entertainment', color: '#EC4899', icon: 'clapperboard' },
  { slug: 'language-culture', nameAr: 'اللغة والثقافة', nameEn: 'Language & Culture', color: '#8B5CF6', icon: 'languages' },
  { slug: 'life-nature', nameAr: 'الحياة والطبيعة', nameEn: 'Life & Nature', color: '#22C55E', icon: 'leaf' },
  { slug: 'local-flavor', nameAr: 'نكهة محلية', nameEn: 'Local Flavor', color: '#F59E0B', icon: 'sparkles' },
  { slug: 'misc-knowledge', nameAr: 'المعرفة المتنوعة', nameEn: 'Mixed Knowledge', color: '#64748B', icon: 'shapes' },
];

export const CATEGORIES: CategoryDef[] = [
  // الثقافة والمعرفة
  { slug: 'general', nameAr: 'الثقافة العامة', nameEn: 'General Culture', group: 'culture-knowledge' },
  { slug: 'arab-world', nameAr: 'العالم العربي', nameEn: 'Arab World', group: 'culture-knowledge' },
  { slug: 'gulf', nameAr: 'الخليج العربي', nameEn: 'The Gulf', group: 'culture-knowledge' },
  { slug: 'history', nameAr: 'التاريخ', nameEn: 'History', group: 'culture-knowledge' },
  { slug: 'islamic-history', nameAr: 'التاريخ الإسلامي', nameEn: 'Islamic History', group: 'culture-knowledge' },
  { slug: 'geography', nameAr: 'الجغرافيا', nameEn: 'Geography', group: 'culture-knowledge' },
  { slug: 'flags-capitals', nameAr: 'الأعلام والعواصم', nameEn: 'Flags & Capitals', group: 'culture-knowledge' },

  // الدول العربية (دولة لكل فئة — تاريخها، دورياتها، جغرافيتها وثقافتها)
  // السعودية تتصدّر الدول العربية (كانت سابقًا ضمن «الثقافة والمعرفة» — نُقلت هنا
  // بطلب العميل 2026-07-21 لتظهر مع بقية الدول العربية).
  { slug: 'saudi', nameAr: 'السعودية', nameEn: 'Saudi Arabia', group: 'arab-countries' },
  { slug: 'country-kuwait', nameAr: 'الكويت', nameEn: 'Kuwait', group: 'arab-countries' },
  { slug: 'country-bahrain', nameAr: 'البحرين', nameEn: 'Bahrain', group: 'arab-countries' },
  { slug: 'country-qatar', nameAr: 'قطر', nameEn: 'Qatar', group: 'arab-countries' },
  { slug: 'country-uae', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', group: 'arab-countries' },
  { slug: 'country-oman', nameAr: 'عُمان', nameEn: 'Oman', group: 'arab-countries' },
  { slug: 'country-iraq', nameAr: 'العراق', nameEn: 'Iraq', group: 'arab-countries' },
  { slug: 'country-syria', nameAr: 'سوريا', nameEn: 'Syria', group: 'arab-countries' },
  { slug: 'country-palestine', nameAr: 'فلسطين', nameEn: 'Palestine', group: 'arab-countries' },
  { slug: 'country-jordan', nameAr: 'الأردن', nameEn: 'Jordan', group: 'arab-countries' },
  { slug: 'country-lebanon', nameAr: 'لبنان', nameEn: 'Lebanon', group: 'arab-countries' },
  { slug: 'country-yemen', nameAr: 'اليمن', nameEn: 'Yemen', group: 'arab-countries' },
  { slug: 'country-egypt', nameAr: 'مصر', nameEn: 'Egypt', group: 'arab-countries' },
  { slug: 'country-sudan', nameAr: 'السودان', nameEn: 'Sudan', group: 'arab-countries' },
  { slug: 'country-libya', nameAr: 'ليبيا', nameEn: 'Libya', group: 'arab-countries' },
  { slug: 'country-tunisia', nameAr: 'تونس', nameEn: 'Tunisia', group: 'arab-countries' },
  { slug: 'country-algeria', nameAr: 'الجزائر', nameEn: 'Algeria', group: 'arab-countries' },
  { slug: 'country-morocco', nameAr: 'المغرب', nameEn: 'Morocco', group: 'arab-countries' },
  { slug: 'country-mauritania', nameAr: 'موريتانيا', nameEn: 'Mauritania', group: 'arab-countries' },

  // الدين الإسلامي
  { slug: 'quran', nameAr: 'القرآن الكريم', nameEn: 'The Holy Quran', group: 'religion' },
  { slug: 'seerah', nameAr: 'السيرة النبوية', nameEn: "The Prophet's Biography", group: 'religion' },
  { slug: 'prophets-companions', nameAr: 'الأنبياء والصحابة', nameEn: 'Prophets & Companions', group: 'religion' },

  // الرياضة
  { slug: 'sports', nameAr: 'الرياضة', nameEn: 'Sports', group: 'sports' },
  { slug: 'football-world', nameAr: 'كرة القدم العالمية', nameEn: 'World Football', group: 'sports' },
  { slug: 'football-arab', nameAr: 'كرة القدم العربية', nameEn: 'Arab Football', group: 'sports' },
  { slug: 'saudi-league', nameAr: 'الدوري السعودي', nameEn: 'Saudi League', group: 'sports' },
  { slug: 'world-cup', nameAr: 'كأس العالم', nameEn: 'World Cup', group: 'sports' },

  // العلوم والتقنية
  { slug: 'science', nameAr: 'العلوم', nameEn: 'Science', group: 'science-tech' },
  { slug: 'space', nameAr: 'الفضاء', nameEn: 'Space', group: 'science-tech' },
  { slug: 'tech', nameAr: 'التقنية', nameEn: 'Technology', group: 'science-tech' },
  { slug: 'ai', nameAr: 'الذكاء الاصطناعي', nameEn: 'Artificial Intelligence', group: 'science-tech' },
  { slug: 'internet-apps', nameAr: 'الإنترنت والتطبيقات', nameEn: 'Internet & Apps', group: 'science-tech' },
  { slug: 'muslim-scientists', nameAr: 'علماء ومخترعون مسلمون', nameEn: 'Muslim Scientists', group: 'science-tech' },

  // النقل والمركبات
  { slug: 'cars', nameAr: 'السيارات', nameEn: 'Cars', group: 'transport' },
  { slug: 'aviation', nameAr: 'الطيران', nameEn: 'Aviation', group: 'transport' },

  // الترفيه
  { slug: 'video-games', nameAr: 'الألعاب الإلكترونية', nameEn: 'Video Games', group: 'entertainment' },
  { slug: 'movies-series', nameAr: 'الأفلام والمسلسلات', nameEn: 'Movies & Series', group: 'entertainment' },
  { slug: 'anime-cartoon', nameAr: 'الأنمي والكرتون', nameEn: 'Anime & Cartoons', group: 'entertainment' },
  { slug: 'celebrities', nameAr: 'المشاهير', nameEn: 'Celebrities', group: 'entertainment' },
  { slug: 'art-music', nameAr: 'الفن والموسيقى', nameEn: 'Art & Music', group: 'entertainment' },
  { slug: 'guess', nameAr: 'خمّن (شعارات وصور)', nameEn: 'Guess (logos & pictures)', group: 'entertainment' },

  // اللغة والثقافة
  { slug: 'arabic-literature', nameAr: 'الأدب واللغة العربية', nameEn: 'Arabic Literature & Language', group: 'language-culture' },
  { slug: 'poetry', nameAr: 'الشعر', nameEn: 'Poetry', group: 'language-culture' },
  { slug: 'proverbs', nameAr: 'الأمثال الشعبية', nameEn: 'Folk Proverbs', group: 'language-culture' },

  // الحياة والطبيعة
  { slug: 'food', nameAr: 'الطعام والمطابخ', nameEn: 'Food & Cuisine', group: 'life-nature' },
  { slug: 'animals', nameAr: 'الحيوانات', nameEn: 'Animals', group: 'life-nature' },
  { slug: 'nature', nameAr: 'الطبيعة', nameEn: 'Nature', group: 'life-nature' },

  // نكهة محلية (recommendations)
  { slug: 'dialects', nameAr: 'اللهجات الخليجية', nameEn: 'Gulf Dialects', group: 'local-flavor' },
  { slug: 'ramadan-drama', nameAr: 'رمضان والدراما الرمضانية', nameEn: 'Ramadan & Drama', group: 'local-flavor' },
  { slug: 'vision2030', nameAr: 'رؤية 2030 والسعودية الحديثة', nameEn: 'Vision 2030', group: 'local-flavor' },
  { slug: 'heritage', nameAr: 'التراث (الإبل والصقور)', nameEn: 'Heritage', group: 'local-flavor' },
  { slug: 'nostalgia', nameAr: 'نوستالجيا التسعينات', nameEn: '90s Nostalgia', group: 'local-flavor' },
  { slug: 'saudi-landmarks', nameAr: 'معالم ومدن المملكة', nameEn: 'Saudi Landmarks', group: 'local-flavor' },

  // المعرفة المتنوعة
  { slug: 'inventions', nameAr: 'الاختراعات والاكتشافات', nameEn: 'Inventions & Discoveries', group: 'misc-knowledge' },
  { slug: 'economy', nameAr: 'الاقتصاد والأعمال', nameEn: 'Economy & Business', group: 'misc-knowledge' },
  { slug: 'currencies', nameAr: 'العملات', nameEn: 'Currencies', group: 'misc-knowledge' },
  { slug: 'medicine-health', nameAr: 'الطب والصحة', nameEn: 'Medicine & Health', group: 'misc-knowledge' },
  { slug: 'military-history', nameAr: 'الجيش والتاريخ العسكري', nameEn: 'Military History', group: 'misc-knowledge' },
  { slug: 'world-wonders', nameAr: 'عجائب العالم', nameEn: 'World Wonders', group: 'misc-knowledge' },
  { slug: 'weird-facts', nameAr: 'حقائق غريبة', nameEn: 'Weird Facts', group: 'misc-knowledge' },
  { slug: 'puzzles-logic', nameAr: 'ألغاز ومنطق', nameEn: 'Puzzles & Logic', group: 'misc-knowledge' },
  { slug: 'true-false', nameAr: 'صح أو خطأ', nameEn: 'True or False', group: 'misc-knowledge' },
];
