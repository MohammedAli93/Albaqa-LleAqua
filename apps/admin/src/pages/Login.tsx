import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { API_URL } from '../api/client.js';
import { useAuth, type AdminUser } from '../store/auth.js';

export function Login() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? 'Login failed');
      setAuth(json.data.accessToken, json.data.user as AdminUser);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full place-items-center bg-slate-100">
      <form onSubmit={submit} className="card w-[400px] p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-violet text-white">
            <ShieldCheck />
          </div>
          <div>
            <h1 className="text-xl font-bold">Tahaddi Admin</h1>
            <p className="text-sm text-slate-500">Sign in to continue</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
            {busy ? <Loader2 className="animate-spin" size={18} /> : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
