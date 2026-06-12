/**
 * Screen state (Zustand). Holds a projection of authoritative server state plus
 * scene-orchestration flags. `applyServerEvent` is the single surface where WS
 * events enter state (doc 06 §4).
 */
import { create } from 'zustand';
import {
  ServerEvent,
  type RoomSnapshot,
  type PublicParticipant,
  type RankedEntry,
  type PublicQuestion,
  type QuestionShowPayload,
  type QuestionRevealPayload,
  type ScoreUpdatePayload,
  type PlayerEliminatedPayload,
  type GameCompletedPayload,
  type TimerTickPayload,
  type AnswerReceivedPayload,
  type TeamPublic,
  type RoundHero,
  type RevealAnswerer,
  type TeamScoredPayload,
  type SeenJeemSnapshot,
  type SjCellResolvedPayload,
} from '@tahaddi/shared';
import type { Locale } from '@tahaddi/i18n';
import { sfx } from './lib/sfx.js';

export type ConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting';

/** Map an incoming server event to a sound cue (best-effort; ignored if muted). */
function playEventSound(event: string): void {
  switch (event) {
    case ServerEvent.QUESTION_SHOW: sfx.whoosh(); break;
    case ServerEvent.ANSWER_LOCKED: sfx.lock(); break;
    case ServerEvent.QUESTION_REVEAL: sfx.reveal(); break;
    case ServerEvent.TEAM_SCORED: sfx.ding(); break;
    case ServerEvent.PLAYER_ELIMINATED: sfx.eliminate(); break;
    case ServerEvent.GAME_COMPLETED: sfx.win(); break;
    default: break;
  }
}

export interface ScreenState {
  conn: ConnState;
  locale: Locale;

  roomCode: string;
  joinUrl: string;

  status: RoomSnapshot['game']['status'];
  type: RoomSnapshot['game']['type'];
  mode: RoomSnapshot['game']['mode'];
  /** Per-player-category mode: each player picks their own category in the lobby. */
  perPlayerCategory: boolean;
  round: number;
  totalRounds: number;
  /** Current question is a sudden-death tie-breaker (shown after an equal-score end). */
  isTiebreak: boolean;
  participants: PublicParticipant[];
  leaderboard: RankedEntry[];

  // current round
  roundId: string | null;
  question: PublicQuestion | null;
  /** Per-player-category mode: whose category this round belongs to. */
  turnPlayer: { nickname: string; avatarId: string } | null;
  /** When answering opens (after the 3-2-1 pre-roll); null = no pending question. */
  startsAt: number | null;
  endsAt: number | null;
  roundTotalMs: number;
  remainingMs: number;
  answeredCount: number;
  totalActive: number;
  phase: 'idle' | 'collecting' | 'locked' | 'reveal' | 'intermission';

  // reveal
  correctOptionId: string | null;
  distribution: Record<string, number>;
  /** Fastest correct answers this round (1st/2nd/3rd), shown on the reveal. */
  topAnswerers: RevealAnswerer[];

  eliminatedThisRound: string[];
  winner: GameCompletedPayload | null;
  paused: boolean;

  // Teams
  teams: TeamPublic[];
  /** TEAMS mode: first-correct winners of the last resolved round. */
  heroes: RoundHero[];
  seenJeem: SeenJeemSnapshot | null;
  sjResolved: SjCellResolvedPayload | null;

  setConn: (c: ConnState) => void;
  setRoom: (code: string, joinUrl: string) => void;
  setLocale: (l: Locale) => void;
  applyServerEvent: (event: string, payload: unknown) => void;
}

export const useStore = create<ScreenState>((set) => ({
  conn: 'idle',
  locale: 'ar',
  roomCode: '',
  joinUrl: '',
  status: 'LOBBY',
  type: 'INDIVIDUAL',
  mode: 'POINTS',
  perPlayerCategory: false,
  round: 0,
  totalRounds: 0,
  isTiebreak: false,
  participants: [],
  leaderboard: [],
  roundId: null,
  question: null,
  turnPlayer: null,
  startsAt: null,
  endsAt: null,
  roundTotalMs: 15000,
  remainingMs: 0,
  answeredCount: 0,
  totalActive: 0,
  phase: 'idle',
  correctOptionId: null,
  distribution: {},
  topAnswerers: [],
  eliminatedThisRound: [],
  winner: null,
  paused: false,
  teams: [],
  heroes: [],
  seenJeem: null,
  sjResolved: null,

  setConn: (conn) => set({ conn }),
  setRoom: (roomCode, joinUrl) => set({ roomCode, joinUrl }),
  setLocale: (locale) => set({ locale }),

  applyServerEvent: (event, payload) => {
    playEventSound(event);
    set((s) => {
      switch (event) {
        case ServerEvent.ROOM_STATE: {
          const snap = payload as RoomSnapshot;
          return {
            status: snap.game.status,
            type: snap.game.type,
            mode: snap.game.mode,
            perPlayerCategory: snap.game.perPlayerCategory ?? false,
            round: snap.game.round,
            totalRounds: snap.game.totalRounds,
            participants: snap.participants,
            leaderboard: snap.leaderboard,
            roundId: snap.currentRound?.roundId ?? null,
            question: snap.currentRound?.question ?? null,
            endsAt: snap.currentRound?.endsAt ?? null,
            phase: snap.currentRound
              ? (snap.currentRound.phase.toLowerCase() as ScreenState['phase'])
              : 'idle',
            paused: snap.game.status === 'PAUSED',
            teams: snap.teams ?? s.teams,
            heroes: snap.heroes ?? s.heroes,
            seenJeem: snap.seenJeem ?? s.seenJeem,
          };
        }
        case ServerEvent.PLAYER_JOINED: {
          const p = (payload as { participant: PublicParticipant }).participant;
          return { participants: [...s.participants.filter((x) => x.id !== p.id), p] };
        }
        case ServerEvent.PLAYER_LEFT: {
          const id = (payload as { participantId: string }).participantId;
          return { participants: s.participants.filter((x) => x.id !== id) };
        }
        case ServerEvent.GAME_STARTED:
          return { status: 'ACTIVE', paused: false };
        case ServerEvent.QUESTION_SHOW: {
          const p = payload as QuestionShowPayload;
          const startsAt = p.startsAt ?? Date.now();
          return {
            status: 'ACTIVE',
            round: p.round,
            roundId: p.roundId,
            question: p.question,
            isTiebreak: p.tiebreak ?? false,
            turnPlayer: p.turnPlayer ?? null,
            startsAt,
            endsAt: p.endsAt,
            roundTotalMs: Math.max(1000, p.endsAt - startsAt),
            remainingMs: Math.max(0, p.endsAt - Date.now()),
            answeredCount: 0,
            phase: 'collecting',
            correctOptionId: null,
            distribution: {},
            topAnswerers: [],
            eliminatedThisRound: [],
            heroes: [],
            paused: false,
          };
        }
        case ServerEvent.TEAM_SCORED: {
          const p = payload as TeamScoredPayload;
          return { heroes: p.heroes };
        }
        case ServerEvent.TIMER_TICK: {
          const p = payload as TimerTickPayload;
          if (p.roundId !== s.roundId) return {};
          return { remainingMs: p.remainingMs };
        }
        case ServerEvent.ANSWER_RECEIVED: {
          const p = payload as AnswerReceivedPayload;
          return { answeredCount: p.answeredCount, totalActive: p.totalActive };
        }
        case ServerEvent.ANSWER_LOCKED:
          return { phase: 'locked', remainingMs: 0 };
        case ServerEvent.QUESTION_REVEAL: {
          const p = payload as QuestionRevealPayload;
          return { phase: 'reveal', correctOptionId: p.correctOptionId, distribution: p.distribution, topAnswerers: p.topAnswerers ?? [] };
        }
        case ServerEvent.SCORE_UPDATE: {
          const p = payload as ScoreUpdatePayload;
          return p.teams ? { leaderboard: p.leaderboard, teams: p.teams } : { leaderboard: p.leaderboard };
        }
        case ServerEvent.PLAYER_ELIMINATED: {
          const p = payload as PlayerEliminatedPayload;
          return { eliminatedThisRound: p.participantIds };
        }
        case ServerEvent.ROUND_COMPLETED:
          return { phase: 'intermission' };
        case ServerEvent.GAME_PAUSED:
          return { paused: true };
        case ServerEvent.GAME_RESUMED:
          return { paused: false };
        case ServerEvent.GAME_COMPLETED: {
          const p = payload as GameCompletedPayload;
          return {
            status: 'COMPLETED',
            winner: p,
            leaderboard: p.finalLeaderboard,
            teams: p.teams ?? s.teams,
            phase: 'idle',
          };
        }
        case ServerEvent.SJ_STATE:
          return { status: 'ACTIVE', seenJeem: payload as SeenJeemSnapshot };
        case ServerEvent.SJ_CELL_OPENED:
          return { sjResolved: null };
        case ServerEvent.SJ_CELL_RESOLVED:
          return { sjResolved: payload as SjCellResolvedPayload };
        default:
          return {};
      }
    });
  },
}));
