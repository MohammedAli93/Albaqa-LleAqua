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
  type GameSettings,
  type CreateRoomResponse,
  type RoomLobbyInfo,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateCapabilityToken, hashCapabilityToken } from '../auth/tokens.js';
import { getPlayerCredits, consumeCredit, refundCredit } from '../payments/paymentService.js';
import { ensureCategoryQuestions } from '../content/questionGen.js';
import { newRoomCode } from './roomCode.js';
import { codeInUse, saveRoom, getRoomByCode } from './roomStore.js';
import type { RoomState } from './types.js';

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Build the round question order for a category game: ensure the category has
 * enough questions (generating on demand), then draw a randomized set. Falls back
 * to an empty list (caller uses the package) if the category can't be filled.
 */
async function categoryQuestionOrder(categoryId: string, desiredRounds: number): Promise<string[]> {
  // Cap the synchronous fill at 15 so a brand-new category starts quickly; the
  // pool grows on each subsequent play. The game then draws up to desiredRounds
  // from whatever is available.
  await ensureCategoryQuestions(categoryId, Math.min(desiredRounds, 15));
  const rows = await prisma.question.findMany({
    where: { categoryId, deletedAt: null, isApproved: true, type: 'MULTIPLE_CHOICE' },
    select: { id: true },
  });
  return shuffle(rows.map((r) => r.id)).slice(0, desiredRounds);
}

/**
 * Pick one question from a single category, preferring ids not in `exclude`;
 * recycle within the category once its distinct questions are spent. Returns null
 * if the category has no usable questions. Used to extend an ELIMINATION game
 * past its scripted order WITHOUT drifting into other categories.
 */
export async function pickCategoryQuestion(categoryId: string, exclude: Set<string>): Promise<string | null> {
  const rows = await prisma.question.findMany({
    where: { categoryId, deletedAt: null, isApproved: true, type: 'MULTIPLE_CHOICE' },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return null;
  const fresh = ids.filter((id) => !exclude.has(id));
  const pool = fresh.length ? fresh : ids; // recycle only once the category is spent
  return pool[Math.floor(Math.random() * pool.length)]!;
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
        where: { categoryId: catId, deletedAt: null, isApproved: true, type: 'MULTIPLE_CHOICE' },
        select: { id: true },
      });
      catPool.set(catId, shuffle(rows.map((r) => r.id)));
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
  const isIndividual = input.settings.type === GameType.INDIVIDUAL;

  // Resolve the package + the effective settings from the tier. The server is
  // authoritative here: a client can't request paid content by sending a packageId.
  let settings: GameSettings = { ...input.settings, tier };
  let pkg: Awaited<ReturnType<typeof findPackageWithQuestions>>;

  if (isIndividual && tier === GameTier.FREE) {
    // FREE: a fixed 15-question set, no categories. No login required.
    pkg = await findPackageWithQuestions({ slug: FREE_PACKAGE_SLUG });
    if (!pkg) throw new AppError(ErrorCode.NOT_FOUND, 'Free pack not seeded — run db:seed');
    settings = { ...settings, perPlayerCategory: false, categoryId: undefined, totalRounds: TIER_ROUNDS.FREE };
  } else {
    // PAID (individual) or TEAMS / SEEN_JEEM: the full category game.
    if (isIndividual && tier === GameTier.PAID) {
      // Fail fast (no decrement) if the host isn't logged in or has no credits.
      if (!input.hostPlayerId || (await getPlayerCredits(input.hostPlayerId)) < 1) {
        throw new AppError(ErrorCode.PAYMENT_REQUIRED, 'تحتاج رصيد لعبة لبدء لعبة النسخة الكاملة');
      }
      settings = { ...settings, totalRounds: TIER_ROUNDS.PAID };
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
    let base = packageOrder;
    if (settings.categoryId) {
      const desired = settings.totalRounds ?? 35;
      const catOrder = await categoryQuestionOrder(settings.categoryId, desired);
      if (catOrder.length >= 4) base = catOrder;
    }
    // Draw only distinct questions — never recycle — so a question never repeats in
    // a game. If the pool is smaller than the requested count the game simply runs
    // fewer rounds. `base` is already shuffled & distinct.
    const requested = settings.totalRounds ?? base.length;
    questionOrder = base.slice(0, requested);
    totalRounds = questionOrder.length;
  }

  // Spend one game-credit for a PAID individual game — atomically, right before
  // we commit the game, so a lost race is denied and a failed create is refunded.
  const paidIndividual = isIndividual && tier === GameTier.PAID;
  if (paidIndividual) {
    if (!input.hostPlayerId || !(await consumeCredit(input.hostPlayerId))) {
      throw new AppError(ErrorCode.PAYMENT_REQUIRED, 'تحتاج رصيد لعبة لبدء لعبة النسخة الكاملة');
    }
  }

  let game;
  try {
    game = await prisma.game.create({
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
  } catch (e) {
    if (paidIndividual && input.hostPlayerId) await refundCredit(input.hostPlayerId);
    throw e;
  }

  const state: RoomState = {
    gameId: game.id,
    roomCode,
    type: settings.type,
    mode: settings.mode,
    status: GameStatus.LOBBY,
    settings,
    hostTokenHash,
    packageId,
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
