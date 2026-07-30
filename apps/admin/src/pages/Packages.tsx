/**
 * Packages — the credit bundles a host buys. Prices are the owner's call, so they are
 * editable here rather than baked into a deploy: save a new price and the storefront
 * (and the amount Tap charges) follows on the buyer's next page load.
 *
 * Orders already placed are untouched — an Order stores the amount it was charged.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Pencil, Check, X, EyeOff, Eye } from 'lucide-react';
import { get, patch } from '../api/client.js';

/** Sellable credit package (what a host buys — 1/2/5/10 games). */
interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameEn?: string | null;
  kind: string;
  credits?: number | null;
  priceMinor: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  adminEdited: boolean;
  _count?: { orders: number };
}

type Draft = { nameAr: string; nameEn: string; price: string; credits: string };

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function Packages() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['adminProducts'],
    queryFn: () => get<{ products: Product[] }>('/api/v1/admin/products'),
  });
  const products = data?.products ?? [];

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ nameAr: '', nameEn: '', price: '', credits: '' });
  const [flash, setFlash] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (p: Product) =>
      patch(`/api/v1/admin/products/${p.id}`, {
        nameAr: draft.nameAr.trim(),
        nameEn: draft.nameEn.trim() || null,
        // Riyals in the form, halalas in the API — round so 20.1 never becomes 2009.
        priceMinor: Math.round(Number(draft.price) * 100),
        ...(p.kind === 'CREDITS' && draft.credits ? { credits: Number(draft.credits) } : {}),
      }),
    onSuccess: (_r, p) => {
      qc.invalidateQueries({ queryKey: ['adminProducts'] });
      setFlash(`Saved — "${draft.nameAr}" now sells for ${Number(draft.price).toFixed(2)} ${p.currency}.`);
      setEditId(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: (p: Product) => patch(`/api/v1/admin/products/${p.id}`, { isActive: !p.isActive }),
    onSuccess: (_r, p) => {
      qc.invalidateQueries({ queryKey: ['adminProducts'] });
      setFlash(p.isActive ? `"${p.nameAr}" is hidden from the storefront.` : `"${p.nameAr}" is back on sale.`);
    },
  });

  function startEdit(p: Product) {
    setEditId(p.id);
    setDraft({
      nameAr: p.nameAr,
      nameEn: p.nameEn ?? '',
      price: (p.priceMinor / 100).toFixed(2),
      credits: p.credits != null ? String(p.credits) : '',
    });
    setFlash(null);
    save.reset();
  }

  const error = (save.error ?? toggleActive.error) as Error | null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Packages</h1>
        <p className="text-sm text-slate-500">
          The game-credit packages hosts can buy. Each credit unlocks one paid (35-question) game.
          Change a price here and the storefront updates immediately.
        </p>
      </div>

      {flash && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className={`card flex flex-col p-5 ${p.isActive ? '' : 'opacity-60'}`}>
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Ticket size={18} />
              <span className="font-mono text-xs text-slate-400">{p.sku}</span>
              {!p.isActive && (
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Hidden</span>
              )}
            </div>

            {editId === p.id ? (
              <div className="space-y-3">
                <div>
                  <label className="label">Name (AR)</label>
                  <input className="input" dir="rtl" autoFocus value={draft.nameAr}
                    onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} />
                </div>
                <div>
                  <label className="label">Name (EN)</label>
                  <input className="input" value={draft.nameEn}
                    onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="label">Price ({p.currency})</label>
                    <input className="input tnum" type="number" min={0} step="0.01" value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') save.mutate(p); if (e.key === 'Escape') setEditId(null); }} />
                  </div>
                  {p.kind === 'CREDITS' && (
                    <div className="w-24">
                      <label className="label">Games</label>
                      <input className="input tnum" type="number" min={1} step={1} value={draft.credits}
                        onChange={(e) => setDraft({ ...draft, credits: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 justify-center"
                    disabled={save.isPending || !draft.nameAr.trim() || draft.price === '' || Number(draft.price) < 0}
                    onClick={() => save.mutate(p)}>
                    <Check size={16} /> {save.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditId(null)}><X size={16} /></button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold" dir="rtl">{p.nameAr}</h3>
                {p.nameEn && <p className="text-sm text-slate-500">{p.nameEn}</p>}
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-2xl font-extrabold tnum">{money(p.priceMinor, p.currency)}</span>
                  {p.kind === 'CREDITS' && p.credits != null && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                      {p.credits} {p.credits === 1 ? 'game' : 'games'}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {p._count?.orders ? `${p._count.orders} order${p._count.orders > 1 ? 's' : ''}` : 'No orders yet'}
                  {p.adminEdited && ' · price set here'}
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="btn-ghost flex-1 justify-center !py-1.5 text-sm" onClick={() => startEdit(p)}>
                    <Pencil size={14} /> Edit price
                  </button>
                  <button className="btn-ghost !px-3 !py-1.5 text-sm"
                    title={p.isActive ? 'Hide from the storefront' : 'Put back on sale'}
                    disabled={toggleActive.isPending}
                    onClick={() => toggleActive.mutate(p)}>
                    {p.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {!products.length && <p className="text-slate-400">No packages found.</p>}
    </div>
  );
}
