import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Crown, Skull } from 'lucide-react';
import { GameType, GameMode, type RankedEntry } from '@tahaddi/shared';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { Hearts } from '../components/Hearts.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Finished() {
  const { winner, participantId, myRank, gameType, gameMode, myTeamId, teams, locale } = useStore();
  const isTeams = gameType === GameType.TEAMS;
  const isElim = gameMode === GameMode.ELIMINATION;
  const iWon = isTeams
    ? !!winner?.winnerTeam && myTeamId === winner.winnerTeam.id
    : winner?.winner?.id === participantId;

  const board = winner?.finalLeaderboard ?? [];
  const teamRanked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 pb-10 pt-9">
      {/* ── Headline ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 16 }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <Crown
          size={iWon ? 72 : 48}
          className={iWon ? 'text-prize-gold' : 'text-ink-muted'}
          style={iWon ? { filter: 'drop-shadow(0 0 22px rgba(245,197,24,0.8))' } : undefined}
        />
        {iWon ? (
          <>
            <p className="font-display text-4xl font-black text-gold-gradient">{t(locale, 'congratulations')}</p>
            <p className="font-display text-xl font-bold text-ink-secondary">
              {isTeams ? t(locale, 'winningTeam') : t(locale, 'champion')}
            </p>
            {isTeams && winner?.winnerTeam && (
              <p className="font-display text-2xl font-extrabold" style={{ color: winner.winnerTeam.color }}>
                {winner.winnerTeam.name}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-3xl font-black">{t(locale, 'gameOver')}</p>
            {!isTeams && myRank > 0 && (
              <p className="font-display text-lg text-ink-secondary">
                {t(locale, 'rank')}: <b className="tnum text-ink-primary">#{myRank}</b>
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* ── Final ranking ── */}
      <div className="mt-7 w-full max-w-sm">
        <p className="mb-3 text-center font-display text-base font-black text-gradient">{t(locale, 'finalRanking')}</p>
        <div className="space-y-2">
          {isTeams
            ? teamRanked.map((team, i) => {
                const mine = team.id === myTeamId;
                return (
                  <Row key={team.id} index={i} highlight={mine}>
                    <Rank rank={i + 1} />
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: team.color }}
                    >
                      {i === 0 ? <Crown size={18} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold" style={{ color: team.color }}>
                      {team.name}
                      {mine && <span className="ms-1.5 text-xs font-bold text-ink-muted">({t(locale, 'you')})</span>}
                    </span>
                    <span className="tnum font-display text-sm font-black">{team.score}</span>
                  </Row>
                );
              })
            : board.map((e: RankedEntry, i) => {
                const mine = e.participantId === participantId;
                const out = e.status === 'ELIMINATED';
                return (
                  <Row key={e.participantId} index={i} highlight={mine} dim={out && !isElim}>
                    <Rank rank={e.rank} />
                    <Avatar avatarId={e.avatarId} size={30} />
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-bold" dir="auto">
                      {e.nickname}
                      {mine && <span className="ms-1.5 text-xs font-bold text-ink-muted">({t(locale, 'you')})</span>}
                    </span>
                    {isElim ? (
                      out ? <Skull size={20} className="shrink-0 text-danger" /> : <Hearts lives={e.lives} size={15} />
                    ) : (
                      <span className="tnum font-display text-sm font-black">{e.score}</span>
                    )}
                  </Row>
                );
              })}
        </div>
      </div>
    </div>
  );
}

function Row({
  children, index, highlight, dim,
}: {
  children: ReactNode;
  index: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className={[
        'flex items-center gap-2.5 rounded-xl px-3 py-2.5',
        highlight ? 'bg-brand-deep/15 ring-1 ring-brand-deep/45' : 'bg-bg-raised/60',
        index === 0 && !highlight ? 'ring-1 ring-prize-gold/50' : '',
        dim ? 'opacity-55' : '',
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}

function Rank({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="w-6 text-center text-xl">{MEDALS[rank - 1]}</span>;
  return <span className="tnum w-6 text-center font-display text-base font-black text-ink-secondary">{rank}</span>;
}
