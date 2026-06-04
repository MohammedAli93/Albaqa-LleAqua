/**
 * Built-in avatar catalogue. Players pick one by id on the controller; the id is
 * stored on the Participant. Avatars are rendered client-side from these tokens
 * (gradient + emoji-free SVG glyph via Lucide), so no image hosting is required
 * and they look crisp on a 4K TV.
 */

export interface AvatarDef {
  id: string;
  /** Display label (for a11y / aria-label), bilingual. */
  labelAr: string;
  labelEn: string;
  /** Two gradient stops used to render the avatar token. */
  gradient: [string, string];
  /** Lucide icon name rendered inside the token. */
  icon: string;
}

export const AVATARS: readonly AvatarDef[] = [
  { id: 'falcon', labelAr: 'الصقر', labelEn: 'Falcon', gradient: ['#7C3AED', '#C026D3'], icon: 'bird' },
  { id: 'lion', labelAr: 'الأسد', labelEn: 'Lion', gradient: ['#F59E0B', '#B8860B'], icon: 'cat' },
  { id: 'rocket', labelAr: 'الصاروخ', labelEn: 'Rocket', gradient: ['#4F46E5', '#22D3EE'], icon: 'rocket' },
  { id: 'crown', labelAr: 'التاج', labelEn: 'Crown', gradient: ['#F5C518', '#B8860B'], icon: 'crown' },
  { id: 'bolt', labelAr: 'الصاعقة', labelEn: 'Bolt', gradient: ['#22D3EE', '#4F46E5'], icon: 'zap' },
  { id: 'flame', labelAr: 'اللهب', labelEn: 'Flame', gradient: ['#EF4444', '#F59E0B'], icon: 'flame' },
  { id: 'star', labelAr: 'النجمة', labelEn: 'Star', gradient: ['#C026D3', '#7C3AED'], icon: 'star' },
  { id: 'diamond', labelAr: 'الماسة', labelEn: 'Diamond', gradient: ['#22D3EE', '#A855F7'], icon: 'gem' },
  { id: 'wolf', labelAr: 'الذئب', labelEn: 'Wolf', gradient: ['#64748B', '#1E293B'], icon: 'dog' },
  { id: 'owl', labelAr: 'البومة', labelEn: 'Owl', gradient: ['#0EA5E9', '#6366F1'], icon: 'glasses' },
  { id: 'ghost', labelAr: 'الشبح', labelEn: 'Ghost', gradient: ['#A855F7', '#6366F1'], icon: 'ghost' },
  { id: 'shield', labelAr: 'الدرع', labelEn: 'Shield', gradient: ['#10B981', '#059669'], icon: 'shield' },
  { id: 'anchor', labelAr: 'المرساة', labelEn: 'Anchor', gradient: ['#0EA5E9', '#0369A1'], icon: 'anchor' },
  { id: 'leaf', labelAr: 'الورقة', labelEn: 'Leaf', gradient: ['#22C55E', '#15803D'], icon: 'leaf' },
  { id: 'moon', labelAr: 'القمر', labelEn: 'Moon', gradient: ['#6366F1', '#312E81'], icon: 'moon' },
  { id: 'sun', labelAr: 'الشمس', labelEn: 'Sun', gradient: ['#F59E0B', '#EA580C'], icon: 'sun' },
] as const;

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function isValidAvatarId(id: string): boolean {
  return AVATAR_IDS.includes(id);
}

export function getAvatar(id: string): AvatarDef | undefined {
  return AVATARS.find((a) => a.id === id);
}
