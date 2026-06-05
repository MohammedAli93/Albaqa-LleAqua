import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client.js';

interface Player {
  id: string;
  username: string;
  email: string;
  mobile: string;
  country: string | null;
  pointsWins: number;
  eliminationWins: number;
  gamesPlayed: number;
  createdAt: string;
}

export function Players() {
  const { data } = useQuery({
    queryKey: ['players'],
    queryFn: () => get<{ items: Player[] }>('/api/v1/admin/players?limit=100'),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Players</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-sm text-slate-500">
            <tr>
              <th className="p-3">Username</th>
              <th className="p-3">Email</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Country</th>
              <th className="p-3">Points wins</th>
              <th className="p-3">Elimination wins</th>
              <th className="p-3">Games</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold" dir="auto">{p.username}</td>
                <td className="p-3 text-sm" dir="ltr">{p.email}</td>
                <td className="p-3 font-mono text-sm" dir="ltr">{p.mobile}</td>
                <td className="p-3">{p.country ?? '—'}</td>
                <td className="p-3 tnum">{p.pointsWins}</td>
                <td className="p-3 tnum">{p.eliminationWins}</td>
                <td className="p-3 tnum">{p.gamesPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.items.length && <p className="p-6 text-center text-slate-400">No players yet.</p>}
      </div>
    </div>
  );
}
