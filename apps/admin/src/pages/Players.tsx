/**
 * Players (hosts). Beyond the roster, this is the support desk: find a host by
 * name/mobile/email and gift them game-credits — e.g. someone who paid for two
 * games but only got to play one.
 */
import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Gift, Minus, Plus, Repeat, Receipt } from 'lucide-react';
import { get, post } from '../api/client.js';

interface Purchase {
  id: string;
  at: string;
  amountMinor: number;
  currency: string;
  package: string;
  credits: number | null;
}

interface Player {
  id: string;
  username: string;
  email: string;
  mobile: string;
  country: string | null;
  pointsWins: number;
  eliminationWins: number;
  teamWins: number;
  gamesPlayed: number;
  createdAt: string;
  isPaid: boolean;
  /** How many separate times this host has paid. */
  paidOrderCount: number;
  /** Games those purchases added up to — one "10 games" order is 1 buy, 10 games. */
  gamesBought: number;
  spentByCurrency: Record<string, number>;
  packages: { name: string; count: number }[];
  lastPurchaseAt: string | null;
  firstPurchaseAt: string | null;
  purchases: Purchase[];
  walletCredits: number;
}

/** "20.00 SAR + 35.00 SAR" style money, from minor units per currency. */
function formatSpent(spentByCurrency: Record<string, number>): string {
  const parts = Object.entries(spentByCurrency).map(
    ([cur, minor]) => `${(minor / 100).toFixed(2)} ${cur}`,
  );
  return parts.length ? parts.join(' + ') : '';
}

const QUICK_GIFTS = [1, 2, 5];

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function Players() {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [giftFor, setGiftFor] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['players', search],
    queryFn: () =>
      get<{ items: Player[] }>(
        `/api/v1/admin/players?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const adjust = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number; username: string }) =>
      post<{ credits: number }>(`/api/v1/admin/players/${id}/credits`, {
        delta,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['players'] });
      setFlash(
        `${vars.delta > 0 ? 'Gifted' : 'Removed'} ${Math.abs(vars.delta)} game${Math.abs(vars.delta) > 1 ? 's' : ''} ${vars.delta > 0 ? 'to' : 'from'} ${vars.username} — balance now ${res.credits}.`,
      );
      closeGift();
    },
  });

  function openGift(id: string) {
    setGiftFor(id);
    setAmount(1);
    setReason('');
    setFlash(null);
    adjust.reset();
  }
  function closeGift() {
    setGiftFor(null);
    setReason('');
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Players</h1>
        <form
          className="relative w-80"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
        >
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name / mobile / email… (Enter)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {search && (
            <button type="button" title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => { setSearchInput(''); setSearch(''); }}>
              <X size={16} />
            </button>
          )}
        </form>
      </div>

      {flash && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {flash}
        </div>
      )}
      {adjust.isError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {(adjust.error as Error).message}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Country</th>
              <th className="p-3" title="How many separate times this host has paid">Times bought</th>
              <th className="p-3">Paid</th>
              <th className="p-3">Package</th>
              <th className="p-3">Credits</th>
              <th className="p-3">Points wins</th>
              <th className="p-3">Elimination wins</th>
              <th className="p-3">Team wins</th>
              <th className="p-3">Games</th>
              <th className="p-3 text-right">Gift</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-t border-slate-100">
                  <td className="p-3 font-semibold" dir="auto">{p.username}</td>
                  <td className="p-3 text-sm" dir="ltr">{p.email}</td>
                  <td className="p-3 font-mono text-sm" dir="ltr">{p.mobile}</td>
                  <td className="p-3">{p.country ?? '—'}</td>
                  <td className="p-3">
                    {p.paidOrderCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${
                          // A repeat buyer is the person worth gifting — make them stand out.
                          p.paidOrderCount > 1 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}
                        title={
                          p.firstPurchaseAt
                            ? `First bought ${day(p.firstPurchaseAt)}${p.lastPurchaseAt && p.lastPurchaseAt !== p.firstPurchaseAt ? ` · last ${day(p.lastPurchaseAt)}` : ''}`
                            : undefined
                        }
                      >
                        {p.paidOrderCount > 1 && <Repeat size={12} />}
                        <span className="tnum">×{p.paidOrderCount}</span>
                        <span className="font-normal opacity-70">· {p.gamesBought} games</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.isPaid ? (
                      <span
                        className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                        title={
                          p.lastPurchaseAt
                            ? `${formatSpent(p.spentByCurrency)} · last ${new Date(p.lastPurchaseAt).toLocaleDateString()}`
                            : undefined
                        }
                      >
                        ✓ {formatSpent(p.spentByCurrency) || 'Upgraded'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        Free
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.packages.length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.packages.map((pkg) => (
                          <span key={pkg.name} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {pkg.name}{pkg.count > 1 ? ` ×${pkg.count}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`tnum inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-sm font-bold ${p.walletCredits > 0 ? 'bg-violet-50 text-brand-violet' : 'bg-slate-100 text-slate-400'}`}>
                      {p.walletCredits}
                    </span>
                  </td>
                  <td className="p-3 tnum">{p.pointsWins}</td>
                  <td className="p-3 tnum">{p.eliminationWins}</td>
                  <td className="p-3 tnum">{p.teamWins}</td>
                  <td className="p-3 tnum">{p.gamesPlayed}</td>
                  <td className="p-3 text-right">
                    <button
                      className="btn-ghost !px-3 !py-1.5 text-sm"
                      onClick={() => (giftFor === p.id ? closeGift() : openGift(p.id))}
                    >
                      <Gift size={14} /> Gift games
                    </button>
                  </td>
                </tr>
                {giftFor === p.id && (
                  <tr className="border-t border-slate-100 bg-violet-50/40">
                    <td colSpan={13} className="p-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <div>
                          <label className="label">Games to add</label>
                          <div className="flex items-center gap-1">
                            <button className="btn-ghost !px-2 !py-2" title="Less"
                              onClick={() => setAmount((v) => Math.max(1, v - 1))}>
                              <Minus size={14} />
                            </button>
                            <input
                              className="input w-20 text-center tnum"
                              type="number" min={1} max={50} value={amount}
                              onChange={(e) => setAmount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                            />
                            <button className="btn-ghost !px-2 !py-2" title="More"
                              onClick={() => setAmount((v) => Math.min(50, v + 1))}>
                              <Plus size={14} />
                            </button>
                            {QUICK_GIFTS.map((n) => (
                              <button key={n} className="btn-ghost !px-3 !py-2 text-sm" onClick={() => setAmount(n)}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="min-w-[16rem] flex-1">
                          <label className="label">Reason (kept in the audit log)</label>
                          <input className="input" dir="auto" placeholder="e.g. bought 2 games, could only play 1"
                            value={reason} onChange={(e) => setReason(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-primary"
                            disabled={adjust.isPending}
                            onClick={() => adjust.mutate({ id: p.id, delta: amount, username: p.username })}
                          >
                            <Gift size={16} />
                            {adjust.isPending ? 'Saving…' : `Give ${amount} game${amount > 1 ? 's' : ''}`}
                          </button>
                          <button
                            className="btn-ghost"
                            disabled={adjust.isPending || p.walletCredits === 0}
                            title="Take credits back (e.g. a mistaken gift)"
                            onClick={() => adjust.mutate({ id: p.id, delta: -amount, username: p.username })}
                          >
                            <Minus size={16} /> Remove {amount}
                          </button>
                          <button className="btn-ghost" onClick={closeGift}>Cancel</button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Current balance: <b className="tnum">{p.walletCredits}</b> · a credit is only spent when a game
                        actually starts, so an unplayed room costs nothing.
                      </p>

                      {/* Buying history — who this host is as a customer, so a gift is an
                          informed decision rather than a guess. */}
                      {p.purchases.length > 0 && (
                        <div className="mt-4 border-t border-violet-200/60 pt-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Receipt size={13} />
                            Bought {p.paidOrderCount} time{p.paidOrderCount > 1 ? 's' : ''} · {p.gamesBought} games · {formatSpent(p.spentByCurrency)}
                          </p>
                          <ul className="space-y-1">
                            {p.purchases.map((o) => (
                              <li key={o.id} className="flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
                                <span className="tnum w-28 text-slate-400">{day(o.at)}</span>
                                <span className="font-medium" dir="auto">{o.package}</span>
                                {o.credits != null && (
                                  <span className="text-slate-400">{o.credits} game{o.credits > 1 ? 's' : ''}</span>
                                )}
                                <span className="tnum ms-auto font-semibold">
                                  {(o.amountMinor / 100).toFixed(2)} {o.currency}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!data?.items.length && (
          <p className="p-6 text-center text-slate-400">
            {search ? 'No player matches that search.' : 'No players yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
