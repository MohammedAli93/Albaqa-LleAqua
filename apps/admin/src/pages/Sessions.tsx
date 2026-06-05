import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client.js';
import { modeLabel, typeLabel } from '../lib/labels.js';

interface Session {
  id: string;
  roomCode: string;
  type: string;
  mode: string;
  status: string;
  createdAt: string;
  package?: { titleEn?: string; titleAr: string };
  result?: { totalPlayers: number; totalRounds: number; durationSec: number };
  _count?: { participants: number };
}

export function Sessions() {
  const { data } = useQuery({ queryKey: ['sessions'], queryFn: () => get<{ items: Session[] }>('/api/v1/admin/sessions?limit=50') });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Sessions</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="p-3">Code</th><th className="p-3">Type</th><th className="p-3">Mode</th><th className="p-3">Package</th>
              <th className="p-3">Players</th><th className="p-3">Rounds</th><th className="p-3">Duration</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3 font-mono font-bold">{s.roomCode}</td>
                <td className="p-3 text-sm">{typeLabel(s.type)}</td>
                <td className="p-3 text-sm">{modeLabel(s.mode)}</td>
                <td className="p-3" dir="rtl">{s.package?.titleAr}</td>
                <td className="p-3 tnum">{s.result?.totalPlayers ?? s._count?.participants ?? 0}</td>
                <td className="p-3 tnum">{s.result?.totalRounds ?? '—'}</td>
                <td className="p-3 tnum">{s.result?.durationSec ? `${s.result.durationSec}s` : '—'}</td>
                <td className="p-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${s.status === 'COMPLETED' ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-500'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && <p className="p-6 text-center text-slate-400">No sessions yet.</p>}
      </div>
    </div>
  );
}
