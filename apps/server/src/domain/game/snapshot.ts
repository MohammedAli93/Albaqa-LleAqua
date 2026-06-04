/** Build client-facing projections from authoritative RoomState. */
import {
  ParticipantStatus,
  SeenJeemPhase,
  type PublicParticipant,
  type RankedEntry,
  type RoomSnapshot,
  type SeenJeemSnapshot,
  type TeamPublic,
} from '@tahaddi/shared';
import type { RoomState, LiveParticipant, LiveSeenJeem } from '../rooms/types.js';

export function toPublicParticipant(p: LiveParticipant): PublicParticipant {
  return {
    id: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
    status: p.status,
    score: p.score,
    lives: p.lives,
    teamId: p.teamId,
  };
}

export function visibleParticipants(state: RoomState): LiveParticipant[] {
  return Object.values(state.participants)
    .filter((p) => p.status !== ParticipantStatus.LEFT)
    .sort((a, b) => a.joinOrder - b.joinOrder);
}

export function publicTeams(state: RoomState): TeamPublic[] {
  return Object.values(state.teams).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    score: t.score,
    memberIds: Object.values(state.participants)
      .filter((p) => p.teamId === t.id)
      .map((p) => p.id),
  }));
}

/**
 * Ranked leaderboard. `delta` carries the points gained in the last resolution
 * if provided, so the screen can flash score changes.
 */
export function buildLeaderboard(
  state: RoomState,
  deltas: Record<string, number> = {},
): RankedEntry[] {
  const ranked = visibleParticipants(state).sort(
    (a, b) => b.score - a.score || a.joinOrder - b.joinOrder,
  );
  return ranked.map((p, i) => ({
    participantId: p.id,
    nickname: p.nickname,
    avatarId: p.avatarId,
    rank: i + 1,
    score: p.score,
    delta: deltas[p.id] ?? 0,
    status: p.status,
    teamId: p.teamId,
  }));
}

/** Public projection of the live Seen-Jeem state (secrets stripped). */
export function buildSeenJeemSnapshot(sj: LiveSeenJeem): SeenJeemSnapshot {
  const activeCell = sj.active ? sj.board.find((c) => c.cellId === sj.active!.cellId) : undefined;
  return {
    phase: sj.phase,
    categories: sj.categories.map((c) => ({
      categoryId: c.categoryId,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      color: c.color,
      icon: c.icon,
      ownerTeamId: c.ownerTeamId,
    })),
    board: sj.board.map((c) => ({
      cellId: c.cellId,
      categoryId: c.categoryId,
      points: c.points,
      consumed: c.consumed,
      awardedTeamId: c.awardedTeamId,
      awardedPoints: c.awardedPoints,
    })),
    turnTeamId: sj.turnTeamId,
    draftPickTeamId:
      sj.phase === SeenJeemPhase.DRAFT ? sj.draftOrder[sj.draftIndex] : undefined,
    lifelines: sj.lifelines,
    active:
      sj.active && sj.active.question && activeCell
        ? {
            cellId: sj.active.cellId,
            categoryId: activeCell.categoryId,
            points: activeCell.points,
            doubled: sj.active.doubled,
            answeringTeamId: sj.active.answeringTeamId,
            removedOptionIds: sj.active.removedOptionIds,
            endsAt: sj.active.endsAt,
            question: sj.active.question,
          }
        : undefined,
  };
}

/** Full snapshot. `selfId` (on /play) adds the connected player's private view. */
export function buildSnapshot(state: RoomState, selfId?: string): RoomSnapshot {
  const self = selfId ? state.participants[selfId] : undefined;
  const cr = state.currentRound;

  return {
    game: {
      id: state.gameId,
      roomCode: state.roomCode,
      mode: state.mode,
      status: state.status,
      round: state.roundIndex + 1,
      totalRounds: state.totalRounds,
    },
    participants: visibleParticipants(state).map(toPublicParticipant),
    teams: Object.keys(state.teams).length ? publicTeams(state) : undefined,
    currentRound: cr
      ? {
          roundId: cr.roundId,
          index: cr.index,
          question: cr.question, // public projection — no correct answer
          endsAt: cr.endsAt,
          phase: cr.phase,
          answeredCount: Object.keys(cr.answers).length,
        }
      : undefined,
    leaderboard: buildLeaderboard(state),
    self: self
      ? {
          participantId: self.id,
          status: self.status,
          score: self.score,
          lives: self.lives,
          hasAnswered: !!cr && !!cr.answers[self.id],
        }
      : undefined,
    seenJeem: state.seenJeem ? buildSeenJeemSnapshot(state.seenJeem) : undefined,
  };
}
