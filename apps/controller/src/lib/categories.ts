import { api } from './config.js';

export interface PickerCategory {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  icon?: string | null;
}

export interface PickerGroup {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  color: string;
  icon?: string | null;
  categories: PickerCategory[];
}

/** Fetch the grouped category catalog for the create-game picker. */
export function fetchCategoryGroups(): Promise<PickerGroup[]> {
  return api<{ groups: PickerGroup[] }>('/api/v1/categories/public').then((d) => d.groups);
}
