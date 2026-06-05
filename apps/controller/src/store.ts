/** Controller state (Zustand). Thin projection of server truth + optimistic UI. */
import { create } from 'zustand';
import {
  ServerEvent,
  GameType,
  GameMode,
  type RoomSnapshot,
  type PublicQuestion,
  type QuestionShowPayload,
  type QuestionRevealPayload,
  type AnswerResultPayload,
  type YouEliminatedPayload,
  type ScoreUpdatePayload,
  type GameCompletedPayload,
  type TimerTickPayload,
  type TeamPublic,
  type RoundHero,
  type TeamScoredPayload,
  type SeenJeemSnapshot,
  type SjCellResolvedPayload,
} from '@tahaddi/shared';
import type { Locale } from '@tahaddi/i18n';
import { loadAccount, type Account } from './lib/account.js';

/** Top-level app surface, above the in-game flow. */
export type AppView = 'splash' | 'login' | 'profile' | 'home' | 'play' | 'game';

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

  question: PublicQuestion | null;
  roundId: string | null;
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

  winner: GameCompletedPayload | null;
  paused: boolean;

  // App shell (front door, above the in-game flow)
  appView: AppView;
  account: Account | null;

  // Seen-Jeem mode
  seenJeem: SeenJeemSnapshot | null;
  myTeamId: string | null;
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
  question: null,
  roundId: null,
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
  winner: null,
  paused: false,
  appView: 'splash',
  account: loadAccount(),
  seenJeem: null,
  myTeamId: null,
  sjResolved: null,

  set: (p) => set(p),

  applyServerEvent: (event, payload) =>
    set(() => {
      const s = get();
      switch (event) {
        case ServerEvent.ROOM_STATE: {
          const snap = payload as RoomSnapshot;
          const self = snap.self;
          const myTeamId =
            snap.participants.find((p) => p.id === s.participantId)?.teamId ?? s.myTeamId;
          const phase = snap.seenJeem ? 'seenjeem' : derivePhase(snap, self?.status);
          return {
            status: snap.game.status,
            gameType: snap.game.type,
            gameMode: snap.game.mode,
            teams: snap.teams ?? s.teams,
            lastHeroes: snap.heroes ?? s.lastHeroes,
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
            phase: s.participantId ? phase : s.phase,
          };
        }
        case ServerEvent.GAME_STARTED:
          return { status: 'ACTIVE', paused: false };
        case ServerEvent.QUESTION_SHOW: {
          if (s.myStatus === 'ELIMINATED') return { phase: 'eliminated' };
          const p = payload as QuestionShowPayload;
          return {
            phase: 'question',
            question: p.question,
            roundId: p.roundId,
            endsAt: p.endsAt,
            roundTotalMs: Math.max(1000, p.endsAt - Date.now()),
            selectedOptionId: null,
            hasAnswered: false,
            correctOptionId: null,
            lastResult: null,
            lastHeroes: [],
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
          return me ? { myRank: me.rank, myScore: me.score } : {};
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
