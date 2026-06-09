#!/usr/bin/env node
/**
 * Starter category images — one command, real photos.
 *
 *   node scripts/fetch-category-images.mjs
 *
 * Pulls a keyword-matched, royalty-free Creative-Commons photo per category from
 * LoremFlickr and saves it to apps/controller/public/categories/<slug>.jpg, where
 * the tiles pick it up automatically. These are *starters* — swap any file for
 * your own curated `<slug>.webp` later for a polished, on-brand look.
 *
 * Needs network access. Re-running re-downloads (LoremFlickr rotates the photo).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'categories');

/** slug → search keywords (English reads better against the photo index). */
const MAP = {
  // ── landing-page showcase ──
  sports: 'soccer,stadium',
  culture: 'culture,heritage',
  arts: 'painting,art',
  history: 'ancient,ruins',
  literature: 'books,library',
  geography: 'mountains,map',
  arab: 'desert,arabia',
  religion: 'mosque,islamic',
  science: 'science,laboratory',
  worldcup: 'football,trophy',
  // ── lobby groups ──
  'culture-knowledge': 'knowledge,books',
  'science-tech': 'technology,circuit',
  transport: 'cars,road',
  entertainment: 'cinema,concert',
  'language-culture': 'arabic,calligraphy',
  'life-nature': 'nature,forest',
  'local-flavor': 'arabia,market',
  'misc-knowledge': 'lightbulb,idea',
  // ── lobby categories ──
  general: 'world,globe',
  'arab-world': 'arabia,city',
  saudi: 'riyadh,saudi',
  gulf: 'dubai,gulf',
  'islamic-history': 'islamic,architecture',
  'flags-capitals': 'flags,city',
  quran: 'quran,mosque',
  seerah: 'mecca,kaaba',
  'prophets-companions': 'mosque,lantern',
  'football-world': 'football,soccer',
  'football-arab': 'football,stadium',
  'saudi-league': 'soccer,stadium',
  space: 'galaxy,space',
  tech: 'computer,technology',
  ai: 'robot,ai',
  'internet-apps': 'smartphone,apps',
  'muslim-scientists': 'astrolabe,manuscript',
  cars: 'sportscar,car',
  aviation: 'airplane,sky',
  'video-games': 'videogame,controller',
  'movies-series': 'cinema,film',
  'anime-cartoon': 'anime,comic',
  celebrities: 'celebrity,redcarpet',
  'art-music': 'music,instrument',
  guess: 'question,mystery',
  'arabic-literature': 'arabic,book',
  poetry: 'poetry,quill',
  proverbs: 'scroll,wisdom',
  food: 'food,feast',
  animals: 'lion,wildlife',
  nature: 'volcano,landscape',
  dialects: 'speech,people',
  'ramadan-drama': 'lantern,ramadan',
  vision2030: 'construction,skyline',
  heritage: 'camel,desert',
  nostalgia: 'retro,vintage',
  'saudi-landmarks': 'riyadh,landmark',
  inventions: 'invention,gears',
  economy: 'finance,chart',
  currencies: 'money,coins',
  'medicine-health': 'medicine,hospital',
  'military-history': 'fortress,armor',
  'world-wonders': 'pyramids,wonder',
  'weird-facts': 'surreal,strange',
  'puzzles-logic': 'puzzle,maze',
  'true-false': 'checkmark,sign',
};

await mkdir(OUT, { recursive: true });

let ok = 0;
let fail = 0;
for (const [slug, kw] of Object.entries(MAP)) {
  const url = `https://loremflickr.com/800/600/${encodeURIComponent(kw)}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) throw new Error('empty response');
    await writeFile(join(OUT, `${slug}.jpg`), buf);
    ok++;
    process.stdout.write(`✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)\n`);
  } catch (e) {
    fail++;
    process.stdout.write(`✗ ${slug}: ${e.message}\n`);
  }
}
process.stdout.write(`\nDone: ${ok} saved, ${fail} failed → ${OUT}\n`);
