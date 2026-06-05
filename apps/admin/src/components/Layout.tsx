import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, HelpCircle, FolderTree, Package, Upload, History, Users, LogOut,
} from 'lucide-react';
import { API_URL } from '../api/client.js';
import { useAuth } from '../store/auth.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/questions', label: 'Questions', icon: HelpCircle },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/packages', label: 'Packages', icon: Package },
  { to: '/import', label: 'Bulk Import', icon: Upload },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: History },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, clear } = useAuth();

  async function logout() {
    await fetch(`${API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    clear();
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-violet font-bold text-white">ت</div>
          <span className="text-lg font-bold">Tahaddi</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${
                  isActive ? 'bg-brand-violet/10 text-brand-violet' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 text-sm">
            <p className="font-semibold">{user?.displayName}</p>
            <p className="text-slate-500">{user?.role}</p>
          </div>
          <button onClick={logout} className="btn-ghost w-full justify-center text-sm">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
