/**
 * Pull the signed-in player's profile from the server and push it into the store
 * (and localStorage) so the wallet balance and the win/played record on screen
 * are the server's numbers, not the ones this device last cached.
 *
 * Client 2026-09-01: «يُخصم الرصيد وتُسجل المباراة بشكل صحيح في النهاية، لكن صفحة
 * الملف الشخصي تستمر مؤقتًا في عرض الرصيد والسجل السابقين… المطلوب تحديث الرصيد
 * وسجل المباريات والانتصارات فور انتهاء المباراة دون الحاجة لإعادة تحميل الصفحة.»
 *
 * The server already writes the stats inside the same transaction that completes
 * the game, and charges the credit when the host presses start — so a fetch at
 * either of those moments is authoritative. What was missing was the fetch: the
 * shell only ever re-read the profile when the Profile screen mounted, and the
 * GET was cacheable on top of that. Both are fixed here and in lib/config.ts.
 *
 * Deliberately quiet: a failed refresh keeps whatever we already had on screen
 * rather than blanking the balance or bouncing the player to the login screen.
 */
import type { PlayerProfile } from '@tahaddi/shared';
import { api } from './config.js';
import { loadAccount, saveAccount, type Account } from './account.js';
import { useStore } from '../store.js';

/** In-flight refresh, so several triggers firing at once make one request. */
let pending: Promise<Account | null> | null = null;

export function refreshAccount(): Promise<Account | null> {
  if (pending) return pending;
  const current = useStore.getState().account ?? loadAccount();
  if (!current) return Promise.resolve(null);

  pending = api<PlayerProfile>('/api/v1/player/me', {
    headers: { Authorization: `Bearer ${current.token}` },
  })
    .then((fresh) => {
      // The token isn't part of the profile payload — keep the one we signed in with.
      const merged: Account = { ...fresh, token: current.token };
      saveAccount(merged);
      useStore.getState().set({ account: merged });
      return merged;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
