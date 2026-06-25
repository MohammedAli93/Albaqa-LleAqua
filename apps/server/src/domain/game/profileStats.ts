/**
 * Profile-stat accrual for finished games. Everyone who joined while signed in
 * gets +1 gamesPlayed; the winner(s) also get +1 on the counter that matches how
 * the game was won:
 *   • TEAMS / Seen-Jeem → teamWins for every member of the winning team
 *   • INDIVIDUAL POINTS → pointsWins for the champion
 *   • INDIVIDUAL ELIMINATION → eliminationWins for the last one standing
 * Returns Prisma update promises to fold into the game's completion transaction,
 * so stats land atomically with the GameResult.
 */
import { GameType, GameMode } from '@tahaddi/shared';
import { prisma } from '../../lib/prisma.js';
import type { RoomState } from '../rooms/types.js';

export function profileStatUpdates(
  state: RoomState,
  winnerId?: string,
  winnerTeamId?: string,
): Array<ReturnType<typeof prisma.player.update>> {
  const linked = Object.values(state.participants).filter((p) => p.playerId);
  if (linked.length === 0) return [];

  const isTeams = state.type === GameType.TEAMS || state.mode === GameMode.SEEN_JEEM;
  const winField = isTeams
    ? 'teamWins'
    : state.mode === GameMode.ELIMINATION
      ? 'eliminationWins'
      : 'pointsWins';

  const winnerPlayerIds = new Set<string>();
  if (isTeams && winnerTeamId) {
    for (const p of linked) if (p.teamId === winnerTeamId) winnerPlayerIds.add(p.playerId!);
  } else if (!isTeams && winnerId) {
    const w = state.participants[winnerId];
    if (w?.playerId) winnerPlayerIds.add(w.playerId);
  }

  const playedIds = [...new Set(linked.map((p) => p.playerId!))];
  return playedIds.map((pid) =>
    prisma.player.update({
      where: { id: pid },
      data: {
        gamesPlayed: { increment: 1 },
        ...(winnerPlayerIds.has(pid) ? { [winField]: { increment: 1 } } : {}),
      },
    }),
  );
}
