import { useState } from 'react';

/** Tried in order — drop a `.webp` (best) or `.jpg`/`.png` and it just works. */
const EXTS = ['webp', 'jpg', 'png'] as const;

/**
 * Photo-backed category art. Looks for `/categories/<slug>.<ext>` (drop your own
 * images into `apps/controller/public/categories/`, or run
 * `node scripts/fetch-category-images.mjs` for a starter set). Until a matching
 * file exists it renders nothing, so the tile's gradient + emoji badge show
 * through as a designed fallback — the UI never looks broken while you source art.
 */
export function CategoryImage({ slug, alt }: { slug: string; alt?: string }) {
  const [i, setI] = useState(0);
  if (i >= EXTS.length) return null;
  return (
    <img
      src={`/categories/${slug}.${EXTS[i]}`}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
      onError={() => setI((n) => n + 1)}
      className="absolute inset-0 h-full w-full scale-105 object-cover transition duration-500 group-active:scale-110"
    />
  );
}
