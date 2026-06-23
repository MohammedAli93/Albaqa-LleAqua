# Desert redesign — home-page assets

Exported from the Figma comp **"بقاء الأقوى1"** (controller home). `Home.tsx`
references each by path and **gracefully hides any that are missing**, so the
page still renders before an asset is dropped in.

## Illustrations / logo / decorative headings (transparent PNG slices)

| File | What it is |
|------|------------|
| `logo-wordmark.png` | Gold 3D "البقاء للأقوى" wordmark (hero) |
| `eyebrow.png` | "برنامج المسابقات الأول" (hero eyebrow) |
| `hero-sub.png` | "لتجربة أجمل العبها على شاشة التلفزيون" |
| `hero-rider.png` | Man + boy on a camel (hero, left) |
| `title-start.png` | "ابدأ لعبة جديدة" |
| `sub-start.png` | "العبوا فردي أو فِرَق على الشاشة الكبيرة." |
| `card-fardi.png` / `card-firaq.png` | فردي / فِرَق chooser cards |
| `jeep.png` | Jeep in the dunes (divider) |
| `title-categories.png` | "استكشف الفئات" |
| `title-howto.png` | "كيف نلعب؟" with the luggage + drum illustrations |
| `camels.png` | Row of walking camels on the dune |
| `cat-1.png … cat-10.png` | The 10 category tiles, sliced 1:1 from the comp (swirl + icon + label baked in) |

Spare swirl-tile colors (`swirl-orange/teal/lime/pink.png`) and `hero-swoosh.png`,
`footer-band.png`, `btn-*.png` are kept for reference but not all are wired in —
buttons, nav, inputs and the footer are recreated in CSS so they stay crisp and
interactive.

## ⚠️ Still needed (export these two nodes from Figma)

These load gracefully (hidden) until present — drop them in to complete the comp:

| File | What it is | Where it appears |
|------|------------|------------------|
| `hero-quad.png` | Man on the blue quad-bike | Hero, **right** side |
| `news-camel.png` | Large camel + rider | "ابقَ على اطلاع" band, left, overlapping |
