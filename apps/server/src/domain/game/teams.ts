/**
 * Team leaders (client rule 2026-08-12).
 *
 * A team answers with ONE voice: its leader. Everyone else is there to advise —
 * before this, a four-player team could just cover all four options and never be
 * wrong, which made every team question a guaranteed point.
 *
 * The stored `team.leaderId` is the deliberate choice (first joiner by default,
 * changeable by the host). The *effective* leader resolves that against who is
 * actually on their phone right now: if the named leader has dropped, the
 * earliest-joined active member covers for them, and the named leader takes the
 * role straight back on reconnect (the stamp is never rewritten by a drop).
 */
import { ParticipantStatus } from '@tahaddi/shared';
import type { LiveParticipant, RoomState } from '../rooms/types.js';

/** Members still on the team (LEFT players are gone), in join order. */
export function teamMembers(state: RoomState, teamId: string): LiveParticipant[] {
  return Object.values(state.participants)
    .filter((p) => p.teamId === teamId && p.status !== ParticipantStatus.LEFT)
    .sort((a, b) => a.joinOrder - b.joinOrder);
}

/**
 * Who may answer for `teamId` right now: the named leader while they're active,
 * otherwise the earliest-joined active member standing in for them.
 */
export function teamLeaderId(state: RoomState, teamId: string): string | undefined {
  const members = teamMembers(state, teamId);
  if (members.length === 0) return undefined;
  const named = members.find((p) => p.id === state.teams[teamId]?.leaderId);
  if (named?.status === ParticipantStatus.ACTIVE) return named.id;
  const standIn = members.find((p) => p.status === ParticipantStatus.ACTIVE);
  return standIn?.id ?? named?.id ?? members[0]!.id;
}

/** Is this participant the one currently answering for their team? */
export function isTeamLeader(state: RoomState, participantId: string): boolean {
  const teamId = state.participants[participantId]?.teamId;
  if (!teamId) return false;
  return teamLeaderId(state, teamId) === participantId;
}

/**
 * Make sure every team has a valid stored leader. Called whenever team membership
 * changes (a pick, an auto-fill at start, someone leaving) so a team is never left
 * pointing at a leader who moved teams or walked out. Never demotes a leader who is
 * merely disconnected — they get the role back when their phone comes back.
 */
export function ensureTeamLeaders(state: RoomState): void {
  for (const team of Object.values(state.teams)) {
    const members = teamMembers(state, team.id);
    const stillHere = members.some((p) => p.id === team.leaderId);
    if (stillHere) continue;
    team.leaderId = members[0]?.id;
  }
}
