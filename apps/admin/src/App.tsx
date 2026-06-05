import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, type AdminUser } from './store/auth.js';
import { API_URL } from './api/client.js';
import { Login } from './pages/Login.js';
import { Layout } from './components/Layout.js';
import { Dashboard } from './pages/Dashboard.js';
import { Questions } from './pages/Questions.js';
import { Categories } from './pages/Categories.js';
import { Packages } from './pages/Packages.js';
import { Import } from './pages/Import.js';
import { Players } from './pages/Players.js';
import { Sessions } from './pages/Sessions.js';

export default function App() {
  const { user, ready, setAuth, setReady } = useAuth();

  // Attempt silent session restore (refresh cookie → access token → /me).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
        const rj = await r.json();
        if (rj.ok) {
          const meRes = await fetch(`${API_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${rj.data.accessToken}` },
            credentials: 'include',
          });
          const mj = await meRes.json();
          if (mj.ok) setAuth(rj.data.accessToken, mj.data as AdminUser);
        }
      } catch {
        /* not logged in */
      } finally {
        setReady();
      }
    })();
  }, [setAuth, setReady]);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="animate-spin text-brand-violet" size={40} />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/import" element={<Import />} />
        <Route path="/players" element={<Players />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
