import { create } from 'zustand';
import type { UserRole } from '@tahaddi/shared';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface AuthState {
  accessToken: string | null; // kept in memory only (XSS-token-theft resistant)
  user: AdminUser | null;
  ready: boolean; // initial refresh attempted
  setAuth: (token: string, user: AdminUser) => void;
  clear: () => void;
  setReady: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
  setReady: () => set({ ready: true }),
}));
