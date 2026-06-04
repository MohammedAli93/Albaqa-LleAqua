import { useQuery } from '@tanstack/react-query';
import { Gamepad2, Users, Clock, CheckCircle2, HelpCircle, Package, FolderTree } from 'lucide-react';
import { get } from '../api/client.js';

interface Overview {
  totalGames: number;
  completedGames: number;
  completionRate: number;
  uniquePlayers: number;
  avgDurationSec: number;
  avgPlayersPerGame: number;
  questionCount: number;
  packageCount: number;
  categoryCount: number;
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: () => get<Overview>('/api/v1/admin/analytics/overview'),
  });

  const stats = [
    { label: 'Games played', value: data?.totalGames ?? 0, icon: Gamepad2, color: 'text-brand-violet' },
    { label: 'Completion rate', value: `${data?.completionRate ?? 0}%`, icon: CheckCircle2, color: 'text-success' },
    { label: 'Unique players', value: data?.uniquePlayers ?? 0, icon: Users, color: 'text-brand-cyan' },
    { label: 'Avg duration', value: `${data?.avgDurationSec ?? 0}s`, icon: Clock, color: 'text-warning' },
    { label: 'Questions', value: data?.questionCount ?? 0, icon: HelpCircle, color: 'text-brand-indigo' },
    { label: 'Packages', value: data?.packageCount ?? 0, icon: Package, color: 'text-brand-magenta' },
    { label: 'Categories', value: data?.categoryCount ?? 0, icon: FolderTree, color: 'text-info' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <s.icon className={s.color} />
              <p className="mt-3 text-3xl font-bold tnum">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
