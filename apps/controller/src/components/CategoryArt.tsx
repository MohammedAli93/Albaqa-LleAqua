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
  'arab-countries': '🌍',
  // ── Arab countries (flag glyphs; Twemoji renders the regional flags) ──
  'country-kuwait': '🇰🇼',
  'country-bahrain': '🇧🇭',
  'country-qatar': '🇶🇦',
  'country-uae': '🇦🇪',
  'country-oman': '🇴🇲',
  'country-iraq': '🇮🇶',
  'country-syria': '🇸🇾',
  'country-palestine': '🇵🇸',
  'country-jordan': '🇯🇴',
  'country-lebanon': '🇱🇧',
  'country-yemen': '🇾🇪',
  'country-egypt': '🇪🇬',
  'country-sudan': '🇸🇩',
  'country-libya': '🇱🇾',
  'country-tunisia': '🇹🇳',
  'country-algeria': '🇩🇿',
  'country-morocco': '🇲🇦',
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
  'egypt-league': '🇪🇬',
  'football-gulf': '🏜️',
  'football-morocco': '🇲🇦',
  'gulf-cup': '🏅',
  'arab-cup': '🏆',
  'asian-cup': '🌏',
  'africa-cup': '🌍',
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
  'cinema-gulf': '📽️',
  'cinema-iraq': '🎞️',
  'cinema-levant': '🎥',
  'anime-cartoon': '🦸',
  celebrities: '⭐',
  'art-music': '🎨',
  'art-gulf': '🪕',
  'art-iraq': '🎻',
  'art-levant': '🎼',
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

/** The emoji glyph for a taxonomy slug (used to build the cartoon Twemoji sticker). */
export function categoryEmoji(slug: string): string {
  return ART[slug] ?? '🎯';
}

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
