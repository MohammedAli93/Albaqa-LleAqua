/** Local player account for the app shell. Mirrors the server PlayerProfile.
 *  Players register with username + email + mobile (no OTP); the JWT + profile
 *  are persisted here for authenticated calls and the home screen. */

export interface Account {
  id: string;
  username: string;
  email: string;
  mobile: string;
  country: string | null;
  avatarId: string;
  pointsWins: number;
  eliminationWins: number;
  teamWins: number;
  gamesPlayed: number;
  /** Remaining game-credits (each PAID 35-question game consumes one). */
  credits: number;
  /** Convenience flag = credits > 0: can start a PAID (35-question) game now. */
  paidUnlocked: boolean;
  /** Player JWT for authenticated calls. */
  token: string;
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
