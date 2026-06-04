/** Local player account for the app shell. Placeholder persistence until the
 *  phone-OTP backend (docs/architecture/13-accounts-auth.md) is wired — then this
 *  is replaced by a verified Player + JWT. Shape mirrors the future Player. */

export interface Account {
  phone: string;
  displayName: string;
  avatarId: string;
  country: string | null;
  leagueWins: number;
  cupWins: number;
}

const KEY = 'albaqa.account';

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account): void {
  localStorage.setItem(KEY, JSON.stringify(a));
}

export function clearAccount(): void {
  localStorage.removeItem(KEY);
}
