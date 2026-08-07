/**
 * Category/group illustration. Maps a taxonomy slug to a glyph so every tile in
 * the picker carries a recognizable visual. The component takes a `slug` + sizing
 * `className`; the art is swappable here without touching the pickers.
 *
 * Mirrors prisma/taxonomy.ts (rev. 2026-08-05). A slug with no entry falls back to
 * 🎯, so a category the owner adds in the admin panel still gets a tile.
 */
const ART: Record<string, string> = {
  // ── groups (فئات رئيسية) ──
  'similar-different': '🔀',
  'local-flavor': '🪔',
  sports: '🏆',
  'culture-knowledge': '🧠',
  religion: '🕌',
  'drama-art': '🎬',
  entertainment: '🎉',
  'science-tech': '🔬',
  'language-culture': '📖',
  transport: '🚗',

  // ── ١) المتشابه والمختلف ──
  'what-similar': '🧩',
  'what-different': '🚫',

  // ── ٢) نكهة محلية ──
  dialects: '💬',
  'dialects-arab': '🗣️',
  vision2030: '🏗️',
  heritage: '🐪',
  'heritage-arab': '🕌',
  nostalgia: '📼',
  'saudi-landmarks': '🕋',
  'world-landmarks': '🗼',

  // ── ٣) الرياضة ──
  'world-cup': '🏆',
  'football-europe': '⚽',
  'football-asia': '🌏',
  'football-africa': '🌍',
  'football-southamerica': '🌎',
  'football-arab': '🏟️',
  'football-gulf': '🏜️',
  'saudi-league': '🥇',
  'premier-league': '🦁',
  laliga: '🐂',

  // ── ٤) الثقافة والمعرفة ──
  general: '🌍',
  'arab-world': '🕌',
  gulf: '🛢️',
  history: '🏛️',
  'islamic-history': '☪️',
  'military-history': '⚔️',
  geography: '🗺️',
  'flags-capitals': '🚩',
  currencies: '💰',

  // ── ٥) الدين الإسلامي ──
  quran: '📖',
  'islamic-culture': '🕌',
  seerah: '🕋',
  'prophets-companions': '🌙',

  // ── ٦) الدراما والفن ──
  'ramadan-drama': '🌙',
  'movies-series': '🎬',
  'cinema-gulf': '📽️',
  'cinema-levant': '🎥',
  'anime-cartoon': '🦸',
  'art-gulf': '🪕',
  artists: '⭐',

  // ── ٧) الترفيه ──
  'video-games': '🎮',
  'social-celebs': '🌟', // «مشاهير السوشل ميديا» — creators and streamers (slug predates the name)
  guess: '❓',
  'world-wonders': '🗿',
  'weird-facts': '🤯',
  'puzzles-logic': '🧠',

  // ── ٨) العلوم والتقنية ──
  'medicine-health': '🩺',
  science: '🔬',
  space: '🚀',
  tech: '💻',
  ai: '🤖',
  'internet-apps': '🌐',
  economy: '📈',
  'scientists-inventors': '⚗️',
  inventions: '💡',

  // ── ٩) اللغة والثقافة ──
  'arabic-literature': '📚',
  poetry: '✒️',
  proverbs: '🗨️',

  // ── ١٠) السيارات والطيران ──
  cars: '🏎️',
  aviation: '✈️',
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
