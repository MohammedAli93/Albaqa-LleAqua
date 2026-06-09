# Category images

Drop one image per category here and it shows up automatically on the tiles —
no code changes needed. Until a file exists, the tile falls back to its gradient
+ emoji badge, so the UI always looks finished.

## Quick start (real photos in one command)

```bash
node scripts/fetch-category-images.mjs   # from apps/controller
```

Downloads a keyword-matched, royalty-free photo per category into this folder as
`<slug>.jpg`. These are **starters** — replace any with your own curated
`<slug>.webp` whenever you want a polished, on-brand look.

## How to add / replace an image

1. Find/create an image that represents the category (photo or illustration).
2. Save it as **`<slug>.webp`** (preferred) or `.jpg`/`.png` in this folder.
3. Refresh — the tile picks it up. `.webp` wins over `.jpg` over `.png`.

## Filenames (slug = filename)

The **landing-page showcase** tiles use these slugs:

| Slug              | Category (AR)      |
| ----------------- | ------------------ |
| `sports.webp`     | رياضة              |
| `culture.webp`    | ثقافة              |
| `arts.webp`       | فنون               |
| `history.webp`    | تاريخ              |
| `literature.webp` | أدب                |
| `geography.webp`  | جغرافيا            |
| `arab.webp`       | الوطن العربي       |
| `religion.webp`   | الدين الإسلامي     |
| `science.webp`    | علوم               |
| `worldcup.webp`   | كأس العالم         |

The **in-game category picker** (lobby) uses the taxonomy slugs — e.g.
`quran.webp`, `football-world.webp`, `cars.webp`, `space.webp`, … (see
`CategoryArt.tsx` for the full list of slugs).

## Tips

- Aim for ~800×600px, landscape, with the subject centered (tiles crop to fill).
- Prefer bright, friendly images with clear subjects — they read at small sizes.
- Keep each file under ~120 KB so the grid loads instantly on mobile data.
- Royalty-free sources: Unsplash, Pexels, Pixabay (check the license).
