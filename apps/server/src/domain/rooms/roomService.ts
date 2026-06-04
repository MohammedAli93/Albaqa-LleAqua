/** Room lifecycle: create (REST bootstrap) + lobby lookup. */
import {
  AppError,
  ErrorCode,
  GameStatus,
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
      mode: 'INDIVIDUAL',
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
    mode: state.mode,
    playerCount: Object.values(state.participants).filter((p) => p.status !== 'LEFT').length,
    maxPlayers: state.settings.maxPlayers,
    packageTitleAr: pkg?.titleAr ?? '',
    packageTitleEn: pkg?.titleEn ?? undefined,
  };
}
