/**
 * AI question-bank generation (Claude). Given a category, ensures the database
 * holds at least N approved multiple-choice questions for it, generating any
 * shortfall with Claude and persisting them (cached forever after).
 *
 * Disabled gracefully when ANTHROPIC_API_KEY is empty — callers fall back to the
 * seeded questions, so the game always works even without a key.
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ mod: 'questionGen' });

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export function isGenerationEnabled(): boolean {
  return !!env.ANTHROPIC_API_KEY;
}

/** Per-category in-flight guard so two rooms don't generate the same batch twice. */
const inFlight = new Map<string, Promise<number>>();

const SYSTEM_PROMPT = `أنت مولّد أسئلة لمسابقة ثقافية عربية موجّهة لجمهور خليجي وسعودي، تُلعب بين العائلة والأصدقاء.
المطلوب: أسئلة اختيار من متعدد، كل سؤال له 4 خيارات وإجابة واحدة صحيحة فقط.
القواعد:
- مناسبة لكل الأعمار، عائلية، بدون أي محتوى حسّاس أو سياسي مثير للجدل أو مسيء.
- دقيقة وصحيحة المعلومة، والإجابة الصحيحة لا لبس فيها.
- متنوعة الصعوبة (سهل/متوسط/صعب/خبير) ومتنوعة الزوايا داخل نفس الموضوع.
- صياغة عربية فصيحة مبسّطة وواضحة، والخيارات قصيرة ومتقاربة المعقولية.
- لا تكرّر سؤالاً ورد في قائمة "أسئلة موجودة".
أعطِ ترجمة إنجليزية مختصرة لكل سؤال وخياراته، وشرحاً عربياً موجزاً للإجابة.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          promptAr: { type: 'string' },
          promptEn: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: { ar: { type: 'string' }, en: { type: 'string' } },
              required: ['ar', 'en'],
            },
          },
          correctIndex: { type: 'integer', enum: [0, 1, 2, 3] },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] },
          explanationAr: { type: 'string' },
        },
        required: ['promptAr', 'promptEn', 'options', 'correctIndex', 'difficulty', 'explanationAr'],
      },
    },
  },
  required: ['questions'],
} as const;

interface GenQuestion {
  promptAr: string;
  promptEn: string;
  options: Array<{ ar: string; en: string }>;
  correctIndex: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  explanationAr: string;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Ensure the category has at least `need` approved MCQs. Generates the shortfall
 * (plus a small buffer) in one Claude call. Returns the number newly created.
 * Never throws to the caller — on failure it logs and returns 0 so the game can
 * proceed with whatever questions already exist.
 */
export async function ensureCategoryQuestions(categoryId: string, need: number): Promise<number> {
  const existing = await prisma.question.count({
    where: { categoryId, deletedAt: null, isApproved: true, type: 'MULTIPLE_CHOICE' },
  });
  if (existing >= need) return 0;

  const anthropic = getClient();
  if (!anthropic) return 0; // generation disabled — caller falls back to the seed

  // Coalesce concurrent requests for the same category.
  const pending = inFlight.get(categoryId);
  if (pending) {
    await pending.catch(() => 0);
    return 0;
  }
  const job = generateForCategory(anthropic, categoryId, need - existing).finally(() => inFlight.delete(categoryId));
  inFlight.set(categoryId, job);
  return job.catch((e) => {
    log.error({ err: e, categoryId }, 'question generation failed');
    return 0;
  });
}

async function generateForCategory(anthropic: Anthropic, categoryId: string, shortfall: number): Promise<number> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { nameAr: true, nameEn: true },
  });
  if (!category) return 0;

  // Generate the shortfall plus a buffer (min 12, max 40 per call) so future games
  // are pre-warmed and the cost amortizes.
  const want = Math.min(Math.max(shortfall + 8, 12), 40);

  const recent = await prisma.question.findMany({
    where: { categoryId, deletedAt: null },
    select: { promptAr: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const existingPrompts = new Set(recent.map((r) => norm(r.promptAr)));
  const avoidList = recent.slice(0, 40).map((r) => `- ${r.promptAr}`).join('\n');

  const userText =
    `الفئة: ${category.nameAr} (${category.nameEn}).\n` +
    `أنشئ ${want} سؤالاً جديداً ومتنوعاً ضمن هذه الفئة.` +
    (avoidList ? `\n\nأسئلة موجودة (لا تكرّرها):\n${avoidList}` : '');

  // Thinking is disabled for this bulk-generation task: it keeps latency low so a
  // first-play category (generated synchronously at room creation) doesn't stall
  // behind a long reasoning pass. The structured-output schema guarantees shape.
  const res = await anthropic.messages.create({
    model: env.QUESTION_MODEL,
    max_tokens: 8000,
    thinking: { type: 'disabled' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  } as never);

  const textBlock = (res.content as Array<{ type: string; text?: string }>).find((b) => b.type === 'text');
  if (!textBlock?.text) return 0;

  let parsed: { questions?: GenQuestion[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    log.warn({ categoryId }, 'could not parse generation JSON');
    return 0;
  }
  const candidates = Array.isArray(parsed.questions) ? parsed.questions : [];

  let created = 0;
  for (const q of candidates) {
    if (!isValid(q)) continue;
    const key = norm(q.promptAr);
    if (existingPrompts.has(key)) continue;
    existingPrompts.add(key);

    const optionDefs = q.options.map((o, i) => ({
      id: String.fromCharCode(97 + i), // a,b,c,d
      textAr: o.ar,
      textEn: o.en,
    }));
    await prisma.question.create({
      data: {
        type: 'MULTIPLE_CHOICE',
        difficulty: q.difficulty,
        categoryId,
        promptAr: q.promptAr,
        promptEn: q.promptEn,
        explanationAr: q.explanationAr,
        options: optionDefs as never,
        correctOptionId: optionDefs[q.correctIndex]!.id,
        timeLimitSec: 15,
        basePoints: 100,
        speedBonus: true,
        isApproved: true,
        tags: ['ai'],
      },
    });
    created++;
  }
  log.info({ categoryId, created, requested: want }, 'generated questions');
  return created;
}

function isValid(q: GenQuestion): boolean {
  return (
    !!q &&
    typeof q.promptAr === 'string' &&
    q.promptAr.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((o) => o && typeof o.ar === 'string' && o.ar.trim().length > 0) &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex <= 3 &&
    ['EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes(q.difficulty)
  );
}
