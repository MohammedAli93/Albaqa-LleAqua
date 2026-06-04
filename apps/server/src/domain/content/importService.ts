/**
 * Bulk question import (CSV / XLSX). Two-phase: PREVIEW validates every row and
 * returns a per-row report with line numbers (no writes); COMMIT transactionally
 * inserts the validated rows. See doc 04 §4.
 */
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { AppError, ErrorCode, QuestionType, Difficulty } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { nanoid } from 'nanoid';

export interface ImportRow {
  line: number;
  raw: Record<string, string>;
  ok: boolean;
  errors: string[];
  parsed?: {
    type: QuestionType;
    difficulty: Difficulty;
    categorySlug: string;
    promptAr: string;
    promptEn?: string;
    options: Array<{ id: string; textAr: string; textEn?: string }>;
    correctOptionId: string;
    timeLimitSec: number;
    basePoints: number;
    explanationAr?: string;
    explanationEn?: string;
    tags: string[];
  };
}

export interface ImportPreview {
  importId: string;
  total: number;
  valid: number;
  invalid: number;
  rows: ImportRow[];
}

const HEADERS = [
  'type', 'difficulty', 'categorySlug', 'promptAr', 'promptEn',
  'optionA_ar', 'optionA_en', 'optionB_ar', 'optionB_en',
  'optionC_ar', 'optionC_en', 'optionD_ar', 'optionD_en',
  'correct', 'timeLimitSec', 'basePoints', 'explanationAr', 'explanationEn', 'tags',
];

const DIFFICULTIES = new Set(Object.values(Difficulty));
const TYPES = new Set(Object.values(QuestionType));

/** Parse an uploaded buffer (csv or xlsx) into header→value records. */
async function toRecords(buffer: Buffer, filename: string): Promise<Record<string, string>[]> {
  if (filename.toLowerCase().endsWith('.csv')) {
    return parseCsv(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new AppError(ErrorCode.VALIDATION_ERROR, 'Empty workbook');
  const headerRow = ws.getRow(1).values as unknown[];
  const headers = headerRow.slice(1).map((h) => String(h ?? '').trim());
  const records: Record<string, string>[] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const rec: Record<string, string> = {};
    const vals = row.values as unknown[];
    headers.forEach((h, i) => {
      rec[h] = String(vals[i + 1] ?? '').trim();
    });
    records.push(rec);
  });
  return records;
}

export async function preview(buffer: Buffer, filename: string): Promise<ImportPreview> {
  const records = await toRecords(buffer, filename);
  if (records.length === 0) throw new AppError(ErrorCode.VALIDATION_ERROR, 'No rows found');
  if (records.length > 1000) throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 'Max 1000 rows per import');

  // Preload categories for slug validation.
  const cats = await prisma.category.findMany({ where: { deletedAt: null }, select: { slug: true } });
  const validSlugs = new Set(cats.map((c) => c.slug));

  const rows: ImportRow[] = records.map((raw, i) => validateRow(raw, i + 2, validSlugs));
  const valid = rows.filter((r) => r.ok).length;

  const importId = nanoid(16);
  // Stash validated rows for commit (10 min TTL).
  await redis.set(
    `import:${importId}`,
    JSON.stringify(rows.filter((r) => r.ok).map((r) => r.parsed)),
    'EX',
    600,
  );

  return { importId, total: rows.length, valid, invalid: rows.length - valid, rows };
}

function validateRow(raw: Record<string, string>, line: number, validSlugs: Set<string>): ImportRow {
  const errors: string[] = [];
  const get = (k: string) => (raw[k] ?? '').trim();

  const type = (get('type') || 'MULTIPLE_CHOICE').toUpperCase();
  if (!TYPES.has(type as QuestionType)) errors.push(`Invalid type "${type}"`);
  const difficulty = (get('difficulty') || 'MEDIUM').toUpperCase();
  if (!DIFFICULTIES.has(difficulty as Difficulty)) errors.push(`Invalid difficulty "${difficulty}"`);

  const categorySlug = get('categorySlug');
  if (!validSlugs.has(categorySlug)) errors.push(`Unknown category "${categorySlug}"`);

  const promptAr = get('promptAr');
  if (!promptAr) errors.push('promptAr is required');

  const optionDefs = [
    { id: 'a', ar: get('optionA_ar'), en: get('optionA_en') },
    { id: 'b', ar: get('optionB_ar'), en: get('optionB_en') },
    { id: 'c', ar: get('optionC_ar'), en: get('optionC_en') },
    { id: 'd', ar: get('optionD_ar'), en: get('optionD_en') },
  ].filter((o) => o.ar);
  if (optionDefs.length < 2) errors.push('At least 2 options required');

  const correct = get('correct').toLowerCase();
  const correctOptionId = { a: 'a', b: 'b', c: 'c', d: 'd' }[correct];
  if (!correctOptionId || !optionDefs.some((o) => o.id === correctOptionId)) {
    errors.push(`"correct" must be A/B/C/D and reference a provided option`);
  }

  const timeLimitSec = Number(get('timeLimitSec')) || 15;
  const basePoints = Number(get('basePoints')) || 100;

  if (errors.length) return { line, raw, ok: false, errors };

  return {
    line,
    raw,
    ok: true,
    errors: [],
    parsed: {
      type: type as QuestionType,
      difficulty: difficulty as Difficulty,
      categorySlug,
      promptAr,
      promptEn: get('promptEn') || undefined,
      options: optionDefs.map((o) => ({ id: o.id, textAr: o.ar, textEn: o.en || undefined })),
      correctOptionId: correctOptionId!,
      timeLimitSec,
      basePoints,
      explanationAr: get('explanationAr') || undefined,
      explanationEn: get('explanationEn') || undefined,
      tags: get('tags') ? get('tags').split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
    },
  };
}

export async function commit(importId: string): Promise<{ created: number }> {
  const raw = await redis.get(`import:${importId}`);
  if (!raw) throw new AppError(ErrorCode.NOT_FOUND, 'Import expired — re-upload and preview again');
  const rows = JSON.parse(raw) as NonNullable<ImportRow['parsed']>[];

  const cats = await prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, slug: true } });
  const slugToId = new Map(cats.map((c) => [c.slug, c.id]));

  const created = await prisma.$transaction(
    rows.map((r) =>
      prisma.question.create({
        data: {
          type: r.type,
          difficulty: r.difficulty,
          categoryId: slugToId.get(r.categorySlug)!,
          promptAr: r.promptAr,
          promptEn: r.promptEn,
          options: r.options as never,
          correctOptionId: r.correctOptionId,
          timeLimitSec: r.timeLimitSec,
          basePoints: r.basePoints,
          explanationAr: r.explanationAr,
          explanationEn: r.explanationEn,
          tags: r.tags,
          isApproved: false,
        },
      }),
    ),
  );

  await redis.del(`import:${importId}`);
  return { created: created.length };
}

export { HEADERS as IMPORT_HEADERS };
