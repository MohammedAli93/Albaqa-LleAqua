/** Room lifecycle: create (REST bootstrap) + lobby lookup. */
import {
  AppError,
  ErrorCode,
  GameStatus,
  GameType,
  GameMode,
  GameTier,
  DEFAULT_TEAM_COUNT,
  FREE_PACKAGE_SLUG,
  TIER_ROUNDS,
  roundsForGame,
  type GameSettings,
  type CreateRoomResponse,
  type RoomLobbyInfo,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateCapabilityToken, hashCapabilityToken } from '../auth/tokens.js';
import { getPlayerCredits } from '../payments/paymentService.js';
import { ensureCategoryQuestions } from '../content/questionGen.js';
import { newRoomCode } from './roomCode.js';
import { codeInUse, saveRoom, getRoomByCode, deleteRoom } from './roomStore.js';
import type { RoomState } from './types.js';

/** Mark questions as shown (increments usageCount) so the NEXT game skips them
 *  until the whole pool has cycled. This is what makes a question "never seen
 *  again" across games until every other approved question has been used. */
export async function markQuestionsUsed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.question.updateMany({
    where: { id: { in: ids } },
    data: { usageCount: { increment: 1 } },
  });
}

/** Difficulties a live game may serve. «الأسئلة الصعبة جداً احذفها» — EXPERT rows
 *  are excluded from every draw (and soft-deleted by the seed). */
const PLAYABLE_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

/** Share of a game's questions that may be HARD. The rest is MEDIUM/EASY, so a
 *  game reads as "medium" overall instead of a wall of hard questions. */
const HARD_SHARE = 0.15;

/**
 * Compose a medium-weighted round order out of difficulty-bucketed candidates.
 * Each bucket is already ordered (least-used first). We take at most `HARD_SHARE`
 * of the count from HARD, fill the rest from MEDIUM then EASY, and top up from
 * whatever is left if a bucket runs dry — so a thin category still yields a full
 * game. The result is shuffled so difficulty isn't clustered at the start.
 */
function blendByDifficulty(
  buckets: { EASY: string[]; MEDIUM: string[]; HARD: string[] },
  count: number,
): string[] {
  const hardQuota = Math.floor(count * HARD_SHARE);
  const picked: string[] = [];
  const take = (from: string[], n: number) => {
    for (let i = 0; i < n && from.length > 0; i++) picked.push(from.shift()!);
  };
  take(buckets.HARD, hardQuota);
  // Alternate MEDIUM/EASY (medium-leaning) for the remainder.
  while (picked.length < count && (buckets.MEDIUM.length > 0 || buckets.EASY.length > 0)) {
    take(buckets.MEDIUM, 2);
    take(buckets.EASY, 1);
  }
  // Still short (thin category / few easy+medium) → top up with the leftovers.
  if (picked.length < count) take(buckets.HARD, count - picked.length);
  return shuffleIds(picked.slice(0, count));
}

/** Random shuffle (used for the fixed free-tier set so replays vary in order). */
function shuffleIds(ids: string[]): string[] {
  return ids
    .map((id) => ({ id, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.id);
}

/**
 * Draw up to `count` approved MCQs, least-recently-used first, then mark them used.
 * Ordering: fewest usageCount first — so a game never repeats what recent games
 * already showed; the entire pool cycles before any question can reappear — then a
 * random tiebreak so games at the same level still feel fresh. The picked set is
 * then composed by difficulty (mostly MEDIUM/EASY, at most ~15% HARD, never
 * EXPERT) so the game reads as medium. Pass `categoryId` to draw from one
 * category; omit it to draw from the WHOLE approved bank (free + normal games).
 * Marking used here means the next game automatically excludes these until the
 * pool wraps.
 */
export async function drawFreshQuestions(count: number, categoryId?: string): Promise<string[]> {
  const rows = await prisma.question.findMany({
    where: {
      deletedAt: null,
      isApproved: true,
      type: 'MULTIPLE_CHOICE',
      difficulty: { in: [...PLAYABLE_DIFFICULTIES] },
      ...(categoryId ? { categoryId } : {}),
    },
    select: { id: true, usageCount: true, difficulty: true },
  });
  if (rows.length === 0) return [];
  const ordered = rows
    .map((r) => ({ id: r.id, used: r.usageCount, diff: r.difficulty, rand: Math.random() }))
    .sort((a, b) => a.used - b.used || a.rand - b.rand);
  const buckets = { EASY: [] as string[], MEDIUM: [] as string[], HARD: [] as string[] };
  for (const r of ordered) (buckets[r.diff as keyof typeof buckets] ?? buckets.MEDIUM).push(r.id);
  const ids = blendByDifficulty(buckets, count);
  await markQuestionsUsed(ids);
  return ids;
}

/**
 * Build the round question order for a category game: ensure the category has
 * enough questions (generating on demand), then draw the least-recently-used set
 * (marking them used). Falls back to an empty list (caller widens the pool) if the
 * category can't be filled.
 */
async function categoryQuestionOrder(categoryId: string, desiredRounds: number): Promise<string[]> {
  // Cap the synchronous fill at 15 so a brand-new category starts quickly; the
  // pool grows on each subsequent play. The game then draws up to desiredRounds
  // from whatever is available.
  await ensureCategoryQuestions(categoryId, Math.min(desiredRounds, 15));
  return drawFreshQuestions(desiredRounds, categoryId);
}

/**
 * Pick one question from a single category, preferring ids not in `exclude`;
 * recycle within the category once its distinct questions are spent. Returns null
 * if the category has no usable questions. Used to extend an ELIMINATION game
 * past its scripted order WITHOUT drifting into other categories.
 */
export async function pickCategoryQuestion(categoryId: string, exclude: Set<string>): Promise<string | null> {
  const rows = await prisma.question.findMany({
    where: {
      categoryId,
      deletedAt: null,
      isApproved: true,
      type: 'MULTIPLE_CHOICE',
      difficulty: { in: [...PLAYABLE_DIFFICULTIES] },
    },
    select: { id: true },
  });
  // Never repeat a question already used this game: only draw from ones not in
  // `exclude`. If the category is fully spent, return null so the caller widens the
  // pool (to other categories) instead of recycling — no in-game repeats.
  const fresh = rows.map((r) => r.id).filter((id) => !exclude.has(id));
  if (fresh.length === 0) return null;
  return fresh[Math.floor(Math.random() * fresh.length)]!;
}

/**
 * Pick a random approved MCQ from the WHOLE bank that isn't in `exclude`. Used as
 * the widening fallback when a game's own category runs out of unused questions, so
 * an ELIMINATION duel or a tiebreak keeps going with a FRESH question instead of
 * repeating one. Returns null only when every approved question is already used
 * (practically never — the bank holds thousands).
 */
export async function pickAnyUnusedQuestion(exclude: Set<string>): Promise<string | null> {
  const rows = await prisma.question.findMany({
    where: {
      deletedAt: null,
      isApproved: true,
      type: 'MULTIPLE_CHOICE',
      difficulty: { in: [...PLAYABLE_DIFFICULTIES] },
    },
    select: { id: true },
  });
  const fresh = rows.map((r) => r.id).filter((id) => !exclude.has(id));
  if (fresh.length === 0) return null;
  return fresh[Math.floor(Math.random() * fresh.length)]!;
}

/** Fallback category for players who never picked one (per-player mode). */
async function defaultCategoryId(): Promise<string | null> {
  const bySlug = await prisma.category.findFirst({ where: { slug: 'general', deletedAt: null }, select: { id: true } });
  if (bySlug) return bySlug.id;
  const any = await prisma.category.findFirst({ where: { deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true } });
  return any?.id ?? null;
}

/**
 * Per-player-category mode: build the round order by rotating through players in
 * join order, each round drawing the next question from THAT player's category.
 * Questions are de-duplicated per category (shared cursor) so the same question
 * never repeats even when players share a category. Returns the question ids and
 * the per-round owner participant ids (aligned).
 */
export async function buildPerPlayerOrder(
  players: { id: string; categoryId?: string }[],
  targetRounds: number,
): Promise<{ questionOrder: string[]; roundOwners: string[] }> {
  if (players.length === 0) return { questionOrder: [], roundOwners: [] };
  const perPlayer = Math.max(1, Math.ceil(targetRounds / players.length));

  // Resolve each player's category (fallback to a default) and build one shuffled
  // pool per distinct category with a shared cursor.
  const fallback = await defaultCategoryId();
  const playerCat = new Map<string, string>();
  const catPool = new Map<string, string[]>();
  const catCursor = new Map<string, number>();
  for (const p of players) {
    const catId = p.categoryId ?? fallback;
    if (!catId) continue;
    playerCat.set(p.id, catId);
    if (!catPool.has(catId)) {
      await ensureCategoryQuestions(catId, Math.min(perPlayer + 4, 15));
      const rows = await prisma.question.findMany({
        where: {
          categoryId: catId,
          deletedAt: null,
          isApproved: true,
          type: 'MULTIPLE_CHOICE',
          difficulty: { in: [...PLAYABLE_DIFFICULTIES] },
        },
        select: { id: true, usageCount: true, difficulty: true },
      });
      // Least-recently-used first, then a random tiebreak — so a paid game never
      // repeats what recent games in this category showed (the category cycles
      // before any question reappears) — then composed medium-first so the pool
      // this player draws from is mostly MEDIUM/EASY (client 2026-07-28).
      const byUse = rows
        .map((r) => ({ id: r.id, used: r.usageCount, diff: r.difficulty, rand: Math.random() }))
        .sort((a, b) => a.used - b.used || a.rand - b.rand);
      const catBuckets = { EASY: [] as string[], MEDIUM: [] as string[], HARD: [] as string[] };
      for (const r of byUse) (catBuckets[r.diff as keyof typeof catBuckets] ?? catBuckets.MEDIUM).push(r.id);
      // Blend only the head the game will actually consume (so the least-used
      // rotation is preserved), then keep the rest as a least-used-first tail for
      // categories that end up carrying more rounds than their share.
      const head = blendByDifficulty(catBuckets, Math.min(byUse.length, targetRounds));
      const inHead = new Set(head);
      const ordered = [...head, ...byUse.map((r) => r.id).filter((id) => !inHead.has(id))];
      catPool.set(catId, ordered);
      catCursor.set(catId, 0);
    }
  }

  const questionOrder: string[] = [];
  const roundOwners: string[] = [];
  for (let r = 0; r < targetRounds; r++) {
    let placed = false;
    // Try the round-robin player first, then the others, so a player with an empty
    // pool doesn't stall the game.
    for (let k = 0; k < players.length; k++) {
      const p = players[(r + k) % players.length]!;
      const catId = playerCat.get(p.id);
      if (!catId) continue;
      const pool = catPool.get(catId)!;
      if (pool.length === 0) continue; // this category has no questions at all
      const idx = catCursor.get(catId)!;
      // No recycling: once a category's distinct questions are used up, skip it so
      // a question never repeats. The game ends a little early rather than repeat.
      if (idx >= pool.length) continue;
      questionOrder.push(pool[idx]!);
      roundOwners.push(p.id);
      catCursor.set(catId, idx + 1);
      placed = true;
      break;
    }
    if (!placed) break; // no player has any questions at all
  }
  // Mark this game's questions used so the next paid game skips them until the
  // category cycles — a question is never seen again while fresher ones remain.
  await markQuestionsUsed(questionOrder);
  return { questionOrder, roundOwners };
}

/** Default team names/colors, indexed by team number. */
export const TEAM_PALETTE = ['#4F46E5', '#14B8A6', '#FB7185', '#F59E0B', '#22C55E', '#A855F7', '#0EA5E9', '#EF4444'];
export const TEAM_NAMES = ['الفريق الأزرق', 'الفريق الأخضر', 'الفريق الوردي', 'الفريق الذهبي', 'الفريق الزمردي', 'الفريق البنفسجي', 'الفريق السماوي', 'الفريق الأحمر'];

/** Load a published, non-deleted package (by slug, or the oldest excluding a slug)
 *  with its ordered question ids. Returns null if none matches. */
async function findPackageWithQuestions(opts: { slug?: string; excludeSlug?: string }) {
  return prisma.package.findFirst({
    where: {
      isPublished: true,
      deletedAt: null,
      ...(opts.slug ? { slug: opts.slug } : {}),
      ...(opts.excludeSlug ? { slug: { not: opts.excludeSlug } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: { questions: { orderBy: { order: 'asc' }, select: { questionId: true } } },
  });
}

/**
 * Retire a host's rooms that were created but never started. Nothing was charged
 * for them (a credit is only spent at start), and leaving them in LOBBY would let
 * players keep joining a room the host has walked away from.
 */
async function abandonUnstartedLobbies(hostPlayerId: string): Promise<void> {
  const stale = await prisma.game.findMany({
    where: { hostPlayerId, status: GameStatus.LOBBY, startedAt: null },
    select: { id: true, roomCode: true },
  });
  if (stale.length === 0) return;
  await prisma.game.updateMany({
    where: { id: { in: stale.map((g) => g.id) } },
    data: { status: GameStatus.ABANDONED, endedAt: new Date() },
  });
  for (const g of stale) await deleteRoom({ gameId: g.id, roomCode: g.roomCode });
}

/** Generate a room code not currently held by a live room. */
async function allocateCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newRoomCode();
    if (!(await codeInUse(code))) return code;
  }
  throw new AppError(ErrorCode.CONFLICT, 'Could not allocate a unique room code');
}

export async function createRoom(input: {
  settings: GameSettings;
  /** Free vs paid tier (INDIVIDUAL). Defaults FREE. */
  tier?: GameTier;
  /** Host's Player account id, when they created the room while logged in. */
  hostPlayerId?: string;
}): Promise<CreateRoomResponse> {
  const tier: GameTier = input.tier ?? GameTier.FREE;
  // Seen Jeem is its own board format and is never sold as a free trial.
  const isFree = tier === GameTier.FREE && input.settings.mode !== GameMode.SEEN_JEEM;

  // Resolve the package + the effective settings from the tier. The server is
  // authoritative here: a client can't request paid content by sending a packageId.
  let settings: GameSettings = { ...input.settings, tier };
  let pkg: Awaited<ReturnType<typeof findPackageWithQuestions>>;

  if (isFree) {
    // FREE: the fixed 15-question trial set, no categories, in EVERY format —
    // individual points, individual elimination and teams alike (client
    // 2026-08-28). No login required.
    pkg = await findPackageWithQuestions({ slug: FREE_PACKAGE_SLUG });
    if (!pkg) throw new AppError(ErrorCode.NOT_FOUND, 'Free pack not seeded — run db:seed');
    settings = { ...settings, perPlayerCategory: false, categoryId: undefined, totalRounds: TIER_ROUNDS.FREE };
  } else {
    // PAID: the full category game (or Seen Jeem).
    if (tier === GameTier.PAID) {
      // Check only — the credit is NOT spent here. It's charged when the host
      // actually starts the game (engine.startGame), so opening a room, sharing the
      // link and then abandoning it (or re-creating it) never costs a credit.
      if (!input.hostPlayerId || (await getPlayerCredits(input.hostPlayerId)) < 1) {
        throw new AppError(ErrorCode.PAYMENT_REQUIRED, 'تحتاج رصيد لعبة لبدء لعبة النسخة الكاملة');
      }
      // Round count is per-format: individual points 35, teams 15, elimination
      // plays on to the last survivor (the number is only its scripted minimum).
      settings = {
        ...settings,
        totalRounds: roundsForGame(input.settings.type, input.settings.mode, tier),
      };
    }
    pkg = await findPackageWithQuestions({ excludeSlug: FREE_PACKAGE_SLUG });
    if (!pkg) throw new AppError(ErrorCode.NOT_FOUND, 'No published package available — run db:seed');
  }
  if (pkg.questions.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, 'Package has no questions');
  }
  const packageId = pkg.id;

  const roomCode = await allocateCode();
  const hostToken = generateCapabilityToken();
  const hostTokenHash = hashCapabilityToken(hostToken);

  // Questions come from the chosen category (generated on demand) when one is set;
  // otherwise from the package's curated list. A too-thin category falls back to
  // the package so a game is always playable. In per-player-category mode the order
  // is built at start (once every player has picked their category).
  const packageOrder = pkg.questions.map((q) => q.questionId);
  let questionOrder = packageOrder;
  let totalRounds: number;
  if (settings.perPlayerCategory) {
    questionOrder = [];
    totalRounds = settings.totalRounds ?? 35;
  } else {
    const requested = settings.totalRounds ?? 15;
    let base: string[] = [];
    if (isFree) {
      // FREE tier: play ONLY the fixed free-15 demo set (reshuffled at the start of
      // every match) and never touch the paid bank — no drawFreshQuestions, no
      // markQuestionsUsed. So the free version replays the same 15 questions in a
      // new order each game and gives away no paid content until the host pays.
      base = shuffleIds(packageOrder).slice(0, requested);
    } else if (settings.categoryId) {
      // Draw the least-recently-used approved questions and mark them used, so a game
      // never repeats what recent games showed — the whole bank (or the chosen
      // category) cycles before any question can reappear.
      base = await categoryQuestionOrder(settings.categoryId, requested);
      if (base.length < 4) base = await drawFreshQuestions(requested); // thin category → widen to whole bank
    } else {
      base = await drawFreshQuestions(requested); // paid/normal: least-used across the whole bank
    }
    // Last-resort fallback to the curated package only if the bank query returns
    // nothing (empty/unseeded DB) so a game is always playable.
    questionOrder = base.length > 0 ? base : packageOrder.slice(0, requested);
    totalRounds = questionOrder.length;
  }

  // A logged-in host only ever needs one open room. Retire any earlier room of
  // theirs that never started, so a re-created room doesn't leave a zombie lobby
  // that players can still join (and nothing was charged for it either way).
  if (input.hostPlayerId) await abandonUnstartedLobbies(input.hostPlayerId);

  const game = await prisma.game.create({
    data: {
      roomCode,
      type: settings.type,
      mode: settings.mode,
      status: GameStatus.LOBBY,
      packageId,
      hostPlayerId: input.hostPlayerId ?? null,
      settings: settings as never,
      hostToken: hostTokenHash,
    },
  });

  const state: RoomState = {
    gameId: game.id,
    roomCode,
    type: settings.type,
    mode: settings.mode,
    status: GameStatus.LOBBY,
    settings,
    hostTokenHash,
    packageId,
    hostPlayerId: input.hostPlayerId,
    questionOrder: questionOrder.slice(0, totalRounds),
    roundIndex: -1,
    totalRounds,
    participants: {},
    teams: {},
    currentRound: null,
    createdAt: Date.now(),
  };

  // TEAMS games create their teams up front so players can pick one in the lobby.
  // Team mode is points-only (no elimination), so teams have no lives to lose and
  // no capacity cap — players join any team freely. Names come from the host.
  if (settings.type === GameType.TEAMS) {
    const names =
      settings.teamNames && settings.teamNames.length >= 2
        ? settings.teamNames
        : Array.from({ length: settings.teamCount ?? DEFAULT_TEAM_COUNT }, (_, i) => TEAM_NAMES[i] ?? `الفريق ${i + 1}`);
    const capacity = settings.playersPerTeam; // undefined = unlimited
    for (let i = 0; i < names.length; i++) {
      const team = await prisma.team.create({
        data: {
          gameId: game.id,
          name: names[i]!.trim() || TEAM_NAMES[i] || `الفريق ${i + 1}`,
          color: TEAM_PALETTE[i] ?? '#4F46E5',
          lives: 1, // unused in points mode; kept for the schema default
          capacity: capacity ?? null,
        },
      });
      state.teams[team.id] = {
        id: team.id,
        name: team.name,
        color: team.color,
        score: 0,
        winMs: 0,
        lives: 1,
        capacity: capacity ?? null,
      };
    }
  }

  await saveRoom(state);

  return {
    gameId: game.id,
    roomCode,
    hostToken, // raw secret, shown to host once
    socketUrl: env.PUBLIC_API_URL,
  };
}

export async function getLobbyInfo(code: string): Promise<RoomLobbyInfo> {
  const state = await getRoomByCode(code);
  if (!state) {
    return {
      exists: false,
      status: 'UNKNOWN',
      type: GameType.INDIVIDUAL,
      mode: GameMode.POINTS,
      playerCount: 0,
      maxPlayers: 0,
      packageTitleAr: '',
    };
  }
  const pkg = await prisma.package.findUnique({
    where: { id: state.packageId },
    select: { titleAr: true, titleEn: true },
  });
  return {
    exists: true,
    status: state.status,
    type: state.type,
    mode: state.mode,
    playerCount: Object.values(state.participants).filter((p) => p.status !== 'LEFT').length,
    maxPlayers: state.settings.maxPlayers,
    packageTitleAr: pkg?.titleAr ?? '',
    packageTitleEn: pkg?.titleEn ?? undefined,
  };
}
