/** Static catalog for the app shell (countries + categories). Categories will be
 *  served from the DB later; this drives the browse UI for now. */

/** Regions the country picker filters by, so the list is browsed rather than scrolled. */
export type Region = 'gulf' | 'levant' | 'africa';

export const REGIONS: { id: Region; nameAr: string }[] = [
  { id: 'gulf', nameAr: 'الخليج' },
  { id: 'levant', nameAr: 'بلاد الشام' },
  { id: 'africa', nameAr: 'شمال أفريقيا' },
];

export interface Country {
  code: string;
  nameAr: string;
  flag: string;
  region: Region;
}

export const COUNTRIES: Country[] = [
  { code: 'SA', nameAr: 'السعودية', flag: '🇸🇦', region: 'gulf' },
  { code: 'KW', nameAr: 'الكويت', flag: '🇰🇼', region: 'gulf' },
  { code: 'BH', nameAr: 'البحرين', flag: '🇧🇭', region: 'gulf' },
  { code: 'QA', nameAr: 'قطر', flag: '🇶🇦', region: 'gulf' },
  { code: 'AE', nameAr: 'الإمارات', flag: '🇦🇪', region: 'gulf' },
  { code: 'OM', nameAr: 'عُمان', flag: '🇴🇲', region: 'gulf' },
  { code: 'YE', nameAr: 'اليمن', flag: '🇾🇪', region: 'gulf' },
  { code: 'SY', nameAr: 'سوريا', flag: '🇸🇾', region: 'levant' },
  { code: 'JO', nameAr: 'الأردن', flag: '🇯🇴', region: 'levant' },
  { code: 'LB', nameAr: 'لبنان', flag: '🇱🇧', region: 'levant' },
  { code: 'EG', nameAr: 'مصر', flag: '🇪🇬', region: 'africa' },
  { code: 'TN', nameAr: 'تونس', flag: '🇹🇳', region: 'africa' },
  { code: 'DZ', nameAr: 'الجزائر', flag: '🇩🇿', region: 'africa' },
  { code: 'MA', nameAr: 'المغرب', flag: '🇲🇦', region: 'africa' },
];

export interface Category {
  id: string;
  nameAr: string;
  /** Emoji used as a colorful watermark on the category tile. */
  icon: string;
  /** Tile gradient [from, to]. */
  gradient: [string, string];
}

export const CATEGORIES: Category[] = [
  { id: 'sports', nameAr: 'رياضة', icon: '⚽', gradient: ['#10B981', '#0D9488'] },
  { id: 'culture', nameAr: 'ثقافة', icon: '🎭', gradient: ['#7C3AED', '#6366F1'] },
  { id: 'arts', nameAr: 'فنون', icon: '🎨', gradient: ['#FB7185', '#E11D48'] },
  { id: 'history', nameAr: 'تاريخ', icon: '🏛️', gradient: ['#F59E0B', '#B45309'] },
  { id: 'literature', nameAr: 'أدب', icon: '📚', gradient: ['#6366F1', '#4F46E5'] },
  { id: 'geography', nameAr: 'جغرافيا', icon: '🗺️', gradient: ['#14B8A6', '#0EA5E9'] },
  { id: 'arab', nameAr: 'الوطن العربي', icon: '🌙', gradient: ['#8B5CF6', '#4F46E5'] },
  { id: 'religion', nameAr: 'الدين الإسلامي', icon: '🕌', gradient: ['#16A34A', '#15803D'] },
  { id: 'science', nameAr: 'علوم', icon: '🔬', gradient: ['#06B6D4', '#3B82F6'] },
  { id: 'worldcup', nameAr: 'كأس العالم', icon: '🏆', gradient: ['#FACC15', '#F59E0B'] },
];
