import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { get } from '../api/client.js';

/** Sellable credit package (what a host buys — 1/2/5/10 games). */
interface Product {
  sku: string;
  nameAr: string;
  nameEn?: string | null;
  kind: string;
  credits?: number | null;
  priceMinor: number;
  currency: string;
}

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function Packages() {
  const { data } = useQuery({
    queryKey: ['products'],
    queryFn: () => get<{ products: Product[] }>('/api/v1/payments/products'),
  });
  const products = data?.products ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Packages</h1>
        <p className="text-sm text-slate-500">The game-credit packages hosts can buy. Each credit unlocks one paid (35-question) game.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.sku} className="card flex flex-col p-5">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Ticket size={18} />
              <span className="font-mono text-xs text-slate-400">{p.sku}</span>
            </div>
            <h3 className="text-lg font-bold" dir="rtl">{p.nameAr}</h3>
            {p.nameEn && <p className="text-sm text-slate-500">{p.nameEn}</p>}
            <div className="mt-4 flex items-end justify-between">
              <span className="text-2xl font-extrabold">{money(p.priceMinor, p.currency)}</span>
              {p.kind === 'CREDITS' && p.credits != null && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                  {p.credits} {p.credits === 1 ? 'game' : 'games'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {!products.length && <p className="text-slate-400">No packages found.</p>}
    </div>
  );
}
