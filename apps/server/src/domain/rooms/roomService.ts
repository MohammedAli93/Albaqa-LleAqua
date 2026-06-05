/** Room lifecycle: create (REST bootstrap) + lobby lookup. */
import {
  AppError,
  ErrorCode,
  GameStatus,
  GameType,
  GameMode,
  DEFAULT_TEAM_COUNT,
  DEFAULT_PLAYERS_PER_TEAM,
  type GameSettings,
  type CreateRoomResponse,
  type RoomLobbyInfo,
} from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { generateCapabilityToken, hashCapabilityToken } from '../auth/tokens.js';
import { newRoomCode } from './roomCode.js';
import { codeInUse, saveRoom, getRoomByCode } from './roomStore.js';
import type { RoomState, LiveTeam } from './types.js';

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

  // TEAMS games create their teams up front so players can pick a team in the
  // lobby (team vs team). Each team starts with a life per the elimination rule.
  if (settings.type === GameType.TEAMS) {
    const teamCount = settings.teamCount ?? DEFAULT_TEAM_COUNT;
    const capacity = settings.playersPerTeam ?? DEFAULT_PLAYERS_PER_TEAM;
    const startingLives = settings.mode === GameMode.ELIMINATION ? settings.livesPerPlayer : 1;
    for (let i = 0; i < teamCount; i++) {
      const team = await prisma.team.create({
        data: {
          gameId: game.id,
          name: TEAM_NAMES[i] ?? `الفريق ${i + 1}`,
          color: TEAM_PALETTE[i] ?? '#4F46E5',
          lives: startingLives,
          capacity,
        },
      });
      const liveTeam: LiveTeam = {
        id: team.id,
        name: team.name,
        color: team.color,
        score: 0,
        lives: startingLives,
        capacity,
      };
      state.teams[team.id] = liveTeam;
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
