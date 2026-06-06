/**
 * Seen-Jeem board scene (Main Screen). Renders the draft, the two teams' boards
 * of point cells, the open question with a countdown, lifeline status, and the
 * reveal flash. Read-only projection — players act on their phones.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, Scissors, Zap, Check, X } from 'lucide-react';
import { SeenJeemPhase, Lifeline, type SeenJeemSnapshot, type TeamPublic } from '@tahaddi/shared';
import { useStore } from '../store.js';
import { host } from '../socket.js';

const LIFELINE_ICON = {
  [Lifeline.CALL_FRIEND]: Phone,
  [Lifeline.DISCARD]: Scissors,
  [Lifeline.DOUBLE]: Zap,
} as const;

function useRemaining(endsAt?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  return endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
}

export function SeenJeem() {
  const sj = useStore((s) => s.seenJeem);
  const teams = useStore((s) => s.teams);
  const resolved = useStore((s) => s.sjResolved);
  const remaining = useRemaining(sj?.active?.endsAt);
  if (!sj) return null;

  const teamIds = sj.categories
    .map((c) => c.ownerTeamId)
    .filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  const idA = teamIds[0] ?? Object.keys(sj.lifelines)[0] ?? '';
  const idB = teamIds[1] ?? Object.keys(sj.lifelines)[1] ?? '';

  const teamScore = (id: string) =>
    sj.board.filter((c) => c.awardedTeamId === id).reduce((n, c) => n + (c.awardedPoints ?? 0), 0);

  return (
    <div className="flex min-h-dvh w-full flex-col gap-4 p-4 lg:h-full lg:gap-6 lg:p-10">
      <div className="grid grid-cols-2 gap-3 lg:gap-6">
        <TeamPanel sj={sj} teams={teams} id={idA} score={teamScore(idA)} align="start" />
        <TeamPanel sj={sj} teams={teams} id={idB} score={teamScore(idB)} align="end" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${sj.phase}:${sj.turnTeamId}:${sj.draftPickTeamId ?? ''}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="text-center font-display text-lg font-bold text-ink-secondary lg:text-2xl"
        >
          {turnBanner(sj, teams)}
        </motion.div>
      </AnimatePresence>

      {sj.phase === SeenJeemPhase.DRAFT ? (
        <DraftBoard sj={sj} teams={teams} />
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-3 lg:gap-6">
          <TeamBoard sj={sj} id={idA} />
          <TeamBoard sj={sj} id={idB} />
        </div>
      )}

      <AnimatePresence>
        {sj.active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-40 grid place-items-center bg-bg-base/85 backdrop-blur-md"
          >
            <div className="glass-strong max-h-[92dvh] w-[60rem] max-w-[92vw] overflow-y-auto rounded-xl3 p-5 text-center lg:p-12">
              <div className="mb-4 flex items-center justify-center gap-4">
                <span className="font-display text-xl font-bold text-brand-cyan lg:text-2xl">
                  {sj.active.points}
                  {sj.active.doubled && <span className="text-brand-gold"> ×2</span>}
                </span>
                <span className="rounded-full bg-bg-raised px-4 py-1 font-display text-xl tabular-nums lg:text-2xl">
                  {remaining}s
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight lg:text-4xl">{sj.active.question.promptAr}</h2>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:mt-8 lg:gap-4">
                {sj.active.question.options.map((o, i) => {
                  const removed = sj.active!.removedOptionIds.includes(o.id);
                  const revealed = resolved?.cellId === sj.active!.cellId;
                  const isCorrect = revealed && resolved.correctOptionId === o.id;
                  const isWrongPick = revealed && resolved.selectedOptionId === o.id && !isCorrect;
                  return (
                    <motion.div
                      key={o.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: removed ? 0.25 : 1, y: 0, scale: isCorrect ? 1.04 : 1 }}
                      transition={{ delay: 0.06 * i, type: 'spring', stiffness: 280, damping: 22 }}
                      className={[
                        'rounded-xl2 p-3 text-base font-semibold lg:p-5 lg:text-2xl',
                        removed ? 'line-through' : 'glass',
                        isCorrect ? 'bg-success/30 ring-2 ring-success' : '',
                        isWrongPick ? 'bg-danger/25 ring-2 ring-danger' : '',
                      ].join(' ')}
                    >
                      {o.textAr}
                    </motion.div>
                  );
                })}
              </div>

              {/* Host arbitration for spoken answers (resolves the cell either way). */}
              {resolved?.cellId !== sj.active.cellId && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:mt-8 lg:gap-4">
                  <span className="w-full text-center text-base text-ink-muted lg:w-auto lg:text-lg">تحكيم المقدّم:</span>
                  <button
                    onClick={() => void host.adjudicate(sj.active!.cellId, true).catch(() => {})}
                    className="flex items-center gap-2 rounded-xl2 bg-success/20 px-5 py-2.5 text-lg font-bold text-success transition hover:bg-success/30 active:scale-95 lg:px-6 lg:py-3 lg:text-xl"
                  >
                    <Check size={22} /> صح
                  </button>
                  <button
                    onClick={() => void host.adjudicate(sj.active!.cellId, false).catch(() => {})}
                    className="flex items-center gap-2 rounded-xl2 bg-danger/20 px-5 py-2.5 text-lg font-bold text-danger transition hover:bg-danger/30 active:scale-95 lg:px-6 lg:py-3 lg:text-xl"
                  >
                    <X size={22} /> خطأ
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function teamMeta(teams: TeamPublic[], id: string, fallbackColor: string, fallbackName: string) {
  const t = teams.find((x) => x.id === id);
  return { name: t?.name ?? fallbackName, color: t?.color ?? fallbackColor };
}

function turnBanner(sj: SeenJeemSnapshot, teams: TeamPublic[]) {
  const id =
    sj.phase === SeenJeemPhase.DRAFT
      ? sj.draftPickTeamId
      : sj.active?.answeringTeamId ?? sj.turnTeamId;
  if (!id) return null;
  const { name, color } = teamMeta(teams, id, '#F5C518', id);
  const verb =
    sj.phase === SeenJeemPhase.DRAFT
      ? 'يختار فئة'
      : sj.phase === SeenJeemPhase.ANSWERING
        ? 'يجيب الآن'
        : 'يختار سؤالاً';
  return (
    <span>
      <span style={{ color }}>{name}</span> {verb}
    </span>
  );
}

function TeamPanel({
  sj,
  teams,
  id,
  score,
  align,
}: {
  sj: SeenJeemSnapshot;
  teams: TeamPublic[];
  id: string;
  score: number;
  align: 'start' | 'end';
}) {
  const meta = teamMeta(teams, id, align === 'start' ? '#7C3AED' : '#22D3EE', id);
  const onTurn = sj.turnTeamId === id || sj.draftPickTeamId === id;
  const ll = sj.lifelines[id];
  return (
    <div
      className={['glass rounded-xl3 p-4 lg:p-6', onTurn ? 'ring-2 ring-brand-gold' : ''].join(' ')}
      style={{ textAlign: align === 'end' ? 'right' : 'left' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-lg font-bold lg:text-2xl" style={{ color: meta.color }}>
          {meta.name}
        </span>
        <span className="font-display text-3xl font-bold tabular-nums lg:text-5xl">{score}</span>
      </div>
      <div className="mt-3 flex gap-3" style={{ justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }}>
        {ll &&
          ([Lifeline.CALL_FRIEND, Lifeline.DISCARD, Lifeline.DOUBLE] as const).map((l) => {
            const Icon = LIFELINE_ICON[l];
            const available = ll[l];
            return (
              <span
                key={l}
                className={['grid h-9 w-9 place-items-center rounded-full', available ? 'bg-brand-violet/30 text-brand-violet' : 'bg-bg-raised text-ink-muted opacity-40'].join(' ')}
              >
                <Icon size={18} />
              </span>
            );
          })}
        {onTurn && <span className="ml-2 self-center text-sm font-semibold text-brand-gold">دورهم</span>}
      </div>
    </div>
  );
}

function DraftBoard({ sj, teams }: { sj: SeenJeemSnapshot; teams: TeamPublic[] }) {
  const picking = sj.draftPickTeamId ? teamMeta(teams, sj.draftPickTeamId, '#F5C518', sj.draftPickTeamId) : null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 lg:gap-8">
      <p className="text-center font-display text-xl font-bold text-ink-secondary lg:text-3xl">
        اختيار الفئات —{' '}
        {picking && <span style={{ color: picking.color }}>{picking.name} يختار الآن</span>}
      </p>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 lg:max-w-none lg:grid-cols-3 lg:gap-6">
        {sj.categories.map((c) => {
          const owner = c.ownerTeamId ? teamMeta(teams, c.ownerTeamId, '#7C3AED', '') : null;
          return (
            <motion.div
              key={c.categoryId}
              layout
              className="grid h-28 w-full place-items-center rounded-xl3 p-4 text-center lg:h-40 lg:w-72 lg:p-6"
              style={{
                background: owner ? `${owner.color}33` : undefined,
                outline: owner ? `2px solid ${owner.color}` : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="font-display text-xl font-bold lg:text-3xl">{c.nameAr}</span>
              {owner && <span className="mt-2 text-sm" style={{ color: owner.color }}>{owner.name}</span>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function TeamBoard({ sj, id }: { sj: SeenJeemSnapshot; id: string }) {
  const cats = sj.categories.filter((c) => c.ownerTeamId === id);
  return (
    <div className="flex flex-col gap-4">
      {cats.map((c) => {
        const cells = sj.board
          .filter((cell) => cell.categoryId === c.categoryId)
          .sort((a, b) => a.points - b.points);
        return (
          <div key={c.categoryId} className="glass rounded-xl2 p-3 lg:p-4">
            <p className="mb-2 truncate font-display text-base font-bold lg:mb-3 lg:text-xl">{c.nameAr}</p>
            <div className="grid grid-cols-6 gap-1.5 lg:gap-2">
              {cells.map((cell) => {
                const open = sj.active?.cellId === cell.cellId;
                return (
                  <motion.div
                    key={cell.cellId}
                    layout
                    animate={{ scale: open ? [1, 1.12, 1] : 1 }}
                    transition={open ? { repeat: Infinity, duration: 1.1 } : { duration: 0.3 }}
                    className={[
                      'grid h-9 place-items-center rounded-lg font-display text-sm font-bold tabular-nums lg:h-12 lg:text-lg',
                      cell.consumed
                        ? 'bg-bg-raised text-ink-muted opacity-40'
                        : open
                          ? 'bg-brand-gold/30 ring-2 ring-brand-gold'
                          : 'bg-brand-violet/20 text-brand-cyan',
                    ].join(' ')}
                  >
                    {cell.consumed ? cell.awardedPoints || '—' : cell.points}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
