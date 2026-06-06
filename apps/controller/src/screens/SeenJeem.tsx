/**
 * Seen-Jeem controller screen. Context-sensitive to the board phase and whose
 * turn it is: draft a category, pick a point cell, answer, or spend a lifeline —
 * otherwise a waiting view. Any team member may act on the team's behalf.
 */
import { useEffect, useState } from 'react';
import { Phone, Scissors, Zap } from 'lucide-react';
import { SeenJeemPhase, Lifeline } from '@tahaddi/shared';
import { useStore } from '../store.js';
import { sjActions } from '../socket.js';

const LIFELINES = [
  { id: Lifeline.CALL_FRIEND, label: 'اتصال', Icon: Phone },
  { id: Lifeline.DISCARD, label: 'حذف', Icon: Scissors },
  { id: Lifeline.DOUBLE, label: 'دبل', Icon: Zap },
] as const;

function useCountdown(endsAt?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
}

export function SeenJeem() {
  const sj = useStore((s) => s.seenJeem);
  const myTeamId = useStore((s) => s.myTeamId);
  const remaining = useCountdown(sj?.active?.endsAt);

  if (!sj || !myTeamId) {
    return <Waiting title="جاري التحضير…" />;
  }

  // ── My turn to answer ──
  if (sj.phase === SeenJeemPhase.ANSWERING && sj.active) {
    if (sj.active.answeringTeamId !== myTeamId) {
      return <Waiting title="دور الفريق الخصم" subtitle={`${sj.active.points} نقطة`} />;
    }
    const ll = sj.lifelines[myTeamId];
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl font-bold text-brand-cyan">
            {sj.active.points}
            {sj.active.doubled && <span className="text-brand-gold"> ×2</span>} نقطة
          </span>
          <span className="rounded-full bg-bg-raised px-4 py-1 font-display text-xl tabular-nums">{remaining}s</span>
        </div>
        <p className="font-display text-xl font-bold leading-snug">{sj.active.question.promptAr}</p>
        <div className="flex flex-col gap-3">
          {sj.active.question.options.map((o) => {
            const removed = sj.active!.removedOptionIds.includes(o.id);
            return (
              <button
                key={o.id}
                disabled={removed}
                onClick={() => void sjActions.answer(sj.active!.cellId, o.id).catch(() => {})}
                className={[
                  'rounded-xl2 p-4 text-start text-lg font-semibold transition active:scale-95',
                  removed ? 'bg-bg-raised opacity-30 line-through' : 'glass',
                ].join(' ')}
              >
                {o.textAr}
              </button>
            );
          })}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-3 pt-4">
          {LIFELINES.map(({ id, label, Icon }) => {
            const available = ll?.[id];
            return (
              <button
                key={id}
                disabled={!available}
                onClick={() => void sjActions.lifeline(id).catch(() => {})}
                className={[
                  'flex flex-col items-center gap-1 rounded-xl2 p-3 transition active:scale-95',
                  available ? 'bg-brand-violet/25 text-brand-violet' : 'bg-bg-raised text-ink-muted opacity-40',
                ].join(' ')}
              >
                <Icon size={22} />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── My turn to draft a category ──
  if (sj.phase === SeenJeemPhase.DRAFT) {
    if (sj.draftPickTeamId !== myTeamId) {
      return <Waiting title="اختيار الفئات" subtitle="الفريق الخصم يختار الآن" />;
    }
    const open = sj.categories.filter((c) => !c.ownerTeamId);
    return (
      <Pickable title="اختر فئة لفريقك">
        {open.map((c) => (
          <button
            key={c.categoryId}
            onClick={() => void sjActions.draftPick(c.categoryId).catch(() => {})}
            className="rounded-xl2 glass p-5 text-lg font-bold active:scale-95"
          >
            {c.nameAr}
          </button>
        ))}
      </Pickable>
    );
  }

  // ── My turn to select a cell ──
  if (sj.phase === SeenJeemPhase.SELECT) {
    if (sj.turnTeamId !== myTeamId) {
      return <Waiting title="دور الفريق الخصم لاختيار سؤال" />;
    }
    const myCats = sj.categories.filter((c) => c.ownerTeamId === myTeamId);
    return (
      <Pickable title="اختر سؤالاً">
        {myCats.map((c) => {
          const cells = sj.board
            .filter((cell) => cell.categoryId === c.categoryId)
            .sort((a, b) => a.points - b.points);
          return (
            <div key={c.categoryId} className="rounded-xl2 glass p-3">
              <p className="mb-2 font-display font-bold">{c.nameAr}</p>
              <div className="grid grid-cols-3 gap-2">
                {cells.map((cell) => (
                  <button
                    key={cell.cellId}
                    disabled={cell.consumed}
                    onClick={() => void sjActions.cellSelect(cell.cellId).catch(() => {})}
                    className={[
                      'rounded-lg p-3 font-display text-lg font-bold tabular-nums active:scale-95',
                      cell.consumed ? 'bg-bg-raised opacity-30' : 'bg-brand-violet/25 text-brand-cyan',
                    ].join(' ')}
                  >
                    {cell.consumed ? '—' : cell.points}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Pickable>
    );
  }

  return <Waiting title="انتظر…" />;
}

function Waiting({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-8 text-center">
      <div>
        <p className="font-display text-3xl font-bold">{title}</p>
        {subtitle && <p className="mt-3 text-lg text-ink-secondary">{subtitle}</p>}
      </div>
    </div>
  );
}

function Pickable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col gap-4 p-5">
      <p className="font-display text-2xl font-bold">{title}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
