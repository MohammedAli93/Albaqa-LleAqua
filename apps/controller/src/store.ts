/** Controller state (Zustand). Thin projection of server truth + optimistic UI. */
import { create } from 'zustand';
import {
  ServerEvent,
  GameType,
  GameMode,
  type GameTier,
  type RoomSnapshot,
  type PublicParticipant,
  type PublicQuestion,
  type QuestionShowPayload,
  type QuestionRevealPayload,
  type AnswerResultPayload,
  type YouEliminatedPayload,
  type ScoreUpdatePayload,
  type GameCompletedPayload,
  type RoundCompletedPayload,
  type TimerTickPayload,
  type TeamPublic,
  type RankedEntry,
  type RoundHero,
  type TeamScoredPayload,
  type SeenJeemSnapshot,
  type SjCellResolvedPayload,
} from '@tahaddi/shared';
import type { Locale } from '@tahaddi/i18n';
import { loadAccount, type Account } from './lib/account.js';

/** Top-level app surface, above the in-game flow. */
export type AppView = 'splash' | 'login' | 'profile' | 'home' | 'play' | 'game' | 'host' | 'upgrade';

/** Config the landing hands to Host mode (type + mode already chosen). */
export interface HostLaunch {
  type: GameType;
  mode: GameMode;
  teamNames?: string[];
  /** Free vs paid tier (INDIVIDUAL games). Defaults FREE. */
  tier?: GameTier;
}

export type Conn = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type Phase = 'join' | 'lobby' | 'question' | 'locked' | 'reveal' | 'result' | 'eliminated' | 'finished' | 'seenjeem';

export interface ControllerState {
  conn: Conn;
  locale: Locale;
  errorCode: string | null;

  roomCode: string;
  participantId: string | null;
  nickname: string;
  avatarId: string;

  phase: Phase;
  status: RoomSnapshot['game']['status'];
  gameType: GameType;
  gameMode: GameMode;
  teams: TeamPublic[];
  lastHeroes: RoundHero[];
  /** Everyone in the room — used to know which categories are already claimed. */
  participants: PublicParticipant[];

  question: PublicQuestion | null;
  roundId: string | null;
  /** When answering opens (after the 3-2-1 pre-roll); null = already open. */
  startsAt: number | null;
  endsAt: number | null;
  roundTotalMs: number;
  selectedOptionId: string | null; // optimistic
  hasAnswered: boolean;
  correctOptionId: string | null;

  myScore: number;
  myLives: number;
  myRank: number;
  myStatus: string;
  lastResult: AnswerResultPayload | null;

  // Round position + standings shown on the phone between questions.
  round: number;
  totalRounds: number;
  /** Current question is a sudden-death tie-breaker (shown after an equal-score end). */
  isTiebreak: boolean;
  leaderboard: RankedEntry[];
  /** The upcoming question's 1-based number + category (from ROUND_COMPLETED). */
  nextRound: number | null;
  nextCategory: RoundCompletedPayload['nextCategory'] | null;

  winner: GameCompletedPayload | null;
  paused: boolean;

  // App shell (front door, above the in-game flow)
  appView: AppView;
  account: Account | null;
  /** When entering Host mode from the landing — the chosen type + mode. */
  hostLaunch: HostLaunch | null;

  // Seen-Jeem mode
  seenJeem: SeenJeemSnapshot | null;
  myTeamId: string | null;
  /** Per-player-category mode: each player picks their own category in the lobby. */
  perPlayerCategory: boolean;
  myCategoryId: string | null;
  sjResolved: SjCellResolvedPayload | null;

  set: (p: Partial<ControllerState>) => void;
  applyServerEvent: (event: string, payload: unknown) => void;
}

export const useStore = create<ControllerState>((set, get) => ({
  conn: 'idle',
  locale: 'ar',
  errorCode: null,
  roomCode: '',
  participantId: null,
  nickname: '',
  avatarId: '',
  phase: 'join',
  status: 'LOBBY',
  gameType: GameType.INDIVIDUAL,
  gameMode: GameMode.POINTS,
  teams: [],
  lastHeroes: [],
  participants: [],
  question: null,
  roundId: null,
  startsAt: null,
  endsAt: null,
  roundTotalMs: 15000,
  selectedOptionId: null,
  hasAnswered: false,
  correctOptionId: null,
  myScore: 0,
  myLives: 1,
  myRank: 0,
  myStatus: 'ACTIVE',
  lastResult: null,
  round: 0,
  totalRounds: 0,
  isTiebreak: false,
  leaderboard: [],
  nextRound: null,
  nextCategory: null,
  winner: null,
  paused: false,
  appView: 'login',
  account: loadAccount(),
  hostLaunch: null,
  seenJeem: null,
  myTeamId: null,
  perPlayerCategory: false,
  myCategoryId: null,
  sjResolved: null,

  set: (p) => set(p),

  applyServerEvent: (event, payload) =>
    set(() => {
      const s = get();
      switch (event) {
        case ServerEvent.ROOM_STATE: {
          const snap = payload as RoomSnapshot;
          const self = snap.self;
          const me = snap.participants.find((p) => p.id === s.participantId);
          const myTeamId = me?.teamId ?? s.myTeamId;
          const phase = snap.seenJeem ? 'seenjeem' : derivePhase(snap, self?.status);
          return {
            status: snap.game.status,
            gameType: snap.game.type,
            gameMode: snap.game.mode,
            teams: snap.teams ?? s.teams,
            lastHeroes: snap.heroes ?? s.lastHeroes,
            participants: snap.participants ?? s.participants,
            leaderboard: snap.leaderboard ?? s.leaderboard,
            round: snap.game.round ?? s.round,
            totalRounds: snap.game.totalRounds ?? s.totalRounds,
            paused: snap.game.status === 'PAUSED',
            question: snap.currentRound?.question ?? null,
            roundId: snap.currentRound?.roundId ?? null,
            endsAt: snap.currentRound?.endsAt ?? null,
            hasAnswered: self?.hasAnswered ?? false,
            myScore: self?.score ?? s.myScore,
            myLives: self?.lives ?? s.myLives,
            myStatus: self?.status ?? s.myStatus,
            seenJeem: snap.seenJeem ?? s.seenJeem,
            myTeamId,
            perPlayerCategory: snap.game.perPlayerCategory ?? false,
            myCategoryId: me?.categoryId ?? s.myCategoryId,
            phase: s.participantId ? phase : s.phase,
          };
        }
        case ServerEvent.GAME_STARTED:
          return { status: 'ACTIVE', paused: false };
        case ServerEvent.QUESTION_SHOW: {
          if (s.myStatus === 'ELIMINATED') return { phase: 'eliminated' };
          const p = payload as QuestionShowPayload;
          const startsAt = p.startsAt ?? Date.now();
          return {
            phase: 'question',
            question: p.question,
            roundId: p.roundId,
            round: p.round,
            isTiebreak: p.tiebreak ?? false,
            startsAt,
            endsAt: p.endsAt,
            roundTotalMs: Math.max(1000, p.endsAt - startsAt),
            selectedOptionId: null,
            hasAnswered: false,
            correctOptionId: null,
            lastResult: null,
            lastHeroes: [],
            nextRound: null,
            nextCategory: null,
            paused: false,
          };
        }
        case ServerEvent.TEAM_SCORED: {
          const p = payload as TeamScoredPayload;
          return { lastHeroes: p.heroes };
        }
        case ServerEvent.TIMER_TICK: {
          const p = payload as TimerTickPayload;
          if (p.roundId !== s.roundId) return {};
          return {};
        }
        case ServerEvent.ANSWER_LOCKED:
          return { phase: s.phase === 'eliminated' ? 'eliminated' : 'locked' };
        case ServerEvent.QUESTION_REVEAL: {
          const p = payload as QuestionRevealPayload;
          return { correctOptionId: p.correctOptionId };
        }
        case ServerEvent.ANSWER_RESULT: {
          const p = payload as AnswerResultPayload;
          return {
            lastResult: p,
            myScore: p.newScore,
            myLives: p.livesLeft,
            phase: 'result',
          };
        }
        case ServerEvent.SCORE_UPDATE: {
          const p = payload as ScoreUpdatePayload;
          const me = p.leaderboard.find((e) => e.participantId === s.participantId);
          return { leaderboard: p.leaderboard, ...(me ? { myRank: me.rank, myScore: me.score } : {}) };
        }
        case ServerEvent.ROUND_COMPLETED: {
          const p = payload as RoundCompletedPayload;
          return { nextRound: p.nextRound ?? null, nextCategory: p.nextCategory ?? null };
        }
        case ServerEvent.YOU_ELIMINATED: {
          const p = payload as YouEliminatedPayload;
          return { phase: 'eliminated', myStatus: 'ELIMINATED', myRank: p.finalRank };
        }
        case ServerEvent.GAME_PAUSED:
          return { paused: true };
        case ServerEvent.GAME_RESUMED:
          return { paused: false };
        case ServerEvent.GAME_COMPLETED: {
          const p = payload as GameCompletedPayload;
          const me = p.finalLeaderboard.find((e) => e.participantId === s.participantId);
          return {
            phase: 'finished',
            status: 'COMPLETED',
            winner: p,
            myRank: me?.rank ?? s.myRank,
            myScore: me?.score ?? s.myScore,
          };
        }
        case ServerEvent.SJ_STATE:
          return { phase: 'seenjeem', status: 'ACTIVE', seenJeem: payload as SeenJeemSnapshot, sjResolved: null };
        case ServerEvent.SJ_CELL_RESOLVED:
          return { sjResolved: payload as SjCellResolvedPayload };
        default:
          return {};
      }
    }),
}));

function derivePhase(snap: RoomSnapshot, selfStatus?: string): Phase {
  if (selfStatus === 'ELIMINATED') return 'eliminated';
  if (snap.game.status === 'COMPLETED') return 'finished';
  if (snap.game.status === 'LOBBY') return 'lobby';
  const ph = snap.currentRound?.phase;
  if (ph === 'COLLECTING') return snap.self?.hasAnswered ? 'locked' : 'question';
  if (ph === 'LOCKED') return 'locked';
  if (ph === 'RESOLVING' || ph === 'INTERMISSION') return 'result';
  return 'lobby';
}
