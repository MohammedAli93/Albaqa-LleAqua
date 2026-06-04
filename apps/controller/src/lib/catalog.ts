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
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'sports', nameAr: 'رياضة', icon: '⚽' },
  { id: 'culture', nameAr: 'ثقافة', icon: '🎭' },
  { id: 'arts', nameAr: 'فنون', icon: '🎨' },
  { id: 'history', nameAr: 'تاريخ', icon: '🏛️' },
  { id: 'literature', nameAr: 'أدب', icon: '📚' },
  { id: 'geography', nameAr: 'جغرافيا', icon: '🗺️' },
  { id: 'arab', nameAr: 'الوطن العربي', icon: '🌙' },
  { id: 'politics', nameAr: 'سياسة', icon: '🏛️' },
  { id: 'science', nameAr: 'علوم', icon: '🔬' },
  { id: 'worldcup', nameAr: 'كأس العالم', icon: '🏆' },
];
