/** Static catalog for the app shell (countries + categories). Categories will be
 *  served from the DB later; this drives the browse UI for now. */

export interface Country {
  code: string;
  nameAr: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'SA', nameAr: 'السعودية', flag: '🇸🇦' },
  { code: 'KW', nameAr: 'الكويت', flag: '🇰🇼' },
  { code: 'BH', nameAr: 'البحرين', flag: '🇧🇭' },
  { code: 'QA', nameAr: 'قطر', flag: '🇶🇦' },
  { code: 'AE', nameAr: 'الإمارات', flag: '🇦🇪' },
  { code: 'OM', nameAr: 'عُمان', flag: '🇴🇲' },
  { code: 'YE', nameAr: 'اليمن', flag: '🇾🇪' },
  { code: 'SY', nameAr: 'سوريا', flag: '🇸🇾' },
  { code: 'JO', nameAr: 'الأردن', flag: '🇯🇴' },
  { code: 'LB', nameAr: 'لبنان', flag: '🇱🇧' },
  { code: 'EG', nameAr: 'مصر', flag: '🇪🇬' },
  { code: 'TN', nameAr: 'تونس', flag: '🇹🇳' },
  { code: 'DZ', nameAr: 'الجزائر', flag: '🇩🇿' },
  { code: 'MA', nameAr: 'المغرب', flag: '🇲🇦' },
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
