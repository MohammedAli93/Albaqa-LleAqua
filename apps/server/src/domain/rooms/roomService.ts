/** Room lifecycle: create (REST bootstrap) + lobby lookup. */
import {
  AppError,
  ErrorCode,
  GameStatus,
  GameType,
  GameMode,
  DEFAULT_TEAM_COUNT,
  type GameSettings,
  type CreateRoomResponse,
  type RoomLobbyInfo,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateCapabilityToken, hashCapabilityToken } from '../auth/tokens.js';
import { newRoomCode } from './roomCode.js';
import { codeInUse, saveRoom, getRoomByCode } from './roomStore.js';
import type { RoomState } from './types.js';

/** Default team names/colors, indexed by team number. */
export const TEAM_PALETTE = ['#4F46E5', '#14B8A6', '#FB7185', '#F59E0B', '#22C55E', '#A855F7', '#0EA5E9', '#EF4444'];
export const TEAM_NAMES = ['الفريق الأزرق', 'الفريق الأخضر', 'الفريق الوردي', 'الفريق الذهبي', 'الفريق الزمردي', 'الفريق البنفسجي', 'الفريق السماوي', 'الفريق الأحمر'];

/** Generate a room code not currently held by a live room. */
async function allocateCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newRoomCode();
    if (!(await codeInUse(code))) return code;
  }
  throw new AppError(ErrorCode.CONFLICT, 'Could not allocate a unique room code');
}

export async function createRoom(
  packageId: string,
  settings: GameSettings,
): Promise<CreateRoomResponse> {
  // Validate the package exists & is published.
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, isPublished: true, deletedAt: null },
    include: { questions: { orderBy: { order: 'asc' }, select: { questionId: true } } },
  });
  if (!pkg) throw new AppError(ErrorCode.NOT_FOUND, 'Package not found or not published');
  if (pkg.questions.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, 'Package has no questions');
  }

  const roomCode = await allocateCode();
  const hostToken = generateCapabilityToken();
  const hostTokenHash = hashCapabilityToken(hostToken);

  const questionOrder = pkg.questions.map((q) => q.questionId);
  const totalRounds = settings.totalRounds
    ? Math.min(settings.totalRounds, questionOrder.length)
    : questionOrder.length;

  const game = await prisma.game.create({
    data: {
      roomCode,
      type: settings.type,
      mode: settings.mode,
      status: GameStatus.LOBBY,
      packageId,
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
