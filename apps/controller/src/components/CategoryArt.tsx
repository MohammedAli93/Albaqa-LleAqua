/**
 * Category/group illustration. Maps a taxonomy slug to a glyph so every tile in
 * the picker carries a recognizable visual. The component takes a `slug` + sizing
 * `className`; the art is swappable here without touching the pickers.
 */
const ART: Record<string, string> = {
  // ── groups ──
  'culture-knowledge': '🧠',
  religion: '🕌',
  sports: '🏆',
  'science-tech': '🔬',
  transport: '🚗',
  entertainment: '🎬',
  'language-culture': '📖',
  'life-nature': '🌿',
  'local-flavor': '🪔',
  'misc-knowledge': '💡',
  // ── categories ──
  general: '🌍',
  'arab-world': '🕌',
  saudi: '🇸🇦',
  gulf: '🛢️',
  history: '🏛️',
  'islamic-history': '☪️',
  geography: '🗺️',
  'flags-capitals': '🚩',
  quran: '📖',
  seerah: '🕋',
  'prophets-companions': '🌙',
  'football-world': '⚽',
  'football-arab': '🏟️',
  'saudi-league': '🥇',
  'world-cup': '🏆',
  science: '🔬',
  space: '🚀',
  tech: '💻',
  ai: '🤖',
  'internet-apps': '📱',
  'muslim-scientists': '⚗️',
  cars: '🏎️',
  aviation: '✈️',
  'video-games': '🎮',
  'movies-series': '🎬',
  'anime-cartoon': '🦸',
  celebrities: '⭐',
  'art-music': '🎨',
  guess: '❓',
  'arabic-literature': '📚',
  poetry: '✒️',
  proverbs: '🗣️',
  food: '🍽️',
  animals: '🦁',
  nature: '🌋',
  dialects: '💬',
  'ramadan-drama': '🌙',
  vision2030: '🏗️',
  heritage: '🐪',
  nostalgia: '📼',
  'saudi-landmarks': '🕌',
  inventions: '💡',
  economy: '📈',
  currencies: '💰',
  'medicine-health': '🩺',
  'military-history': '⚔️',
  'world-wonders': '🗿',
  'weird-facts': '🤯',
  'puzzles-logic': '🧩',
  'true-false': '✅',
};

export function CategoryArt({ slug, className }: { slug: string; className?: string }) {
  const glyph = ART[slug] ?? '🎯';
  return (
    <span
      aria-hidden
      className={className}
      style={{ display: 'grid', placeItems: 'center', fontSize: '1.7rem', lineHeight: 1 }}
    >
      {glyph}
    </span>
  );
}
