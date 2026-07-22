import { useEffect, useState } from 'react';
import { Sparkles, ChevronRight, Trophy, Swords, Users, Gamepad2, Check } from 'lucide-react';
import { AVATARS, type PlayerProfile } from '@tahaddi/shared';
import { useStore } from '../../store.js';
import { Avatar } from '../../components/Avatar.js';
import { api } from '../../lib/config.js';
import { saveAccount, type Account } from '../../lib/account.js';
import { COUNTRIES } from '../../lib/catalog.js';
import { AuthShell, AuthCard, CtaButton } from './AuthShell.js';

/** Warm tile gradients for the country picker — rotated by index so each flag
 *  sits on a colourful card like the category tiles (client request 2026-07-23). */
const COUNTRY_TILES: [string, string][] = [
  ['#F2A65A', '#E17E2B'], ['#5AA9E6', '#2E7FC2'], ['#7BC47F', '#4C9A50'],
  ['#B58BE0', '#8A5FC0'], ['#EF8A6B', '#DC5038'], ['#5EC2C7', '#2E9BA0'],
  ['#E9C15A', '#D69B23'], ['#E0798F', '#C64C67'],
];

/** Profile completion after registration — avatar + country, on the desert card.
 *  Full-bleed + responsive (mobile / desktop / TV); logic unchanged. */
export function Profile() {
  const { account, set } = useStore();
  const [avatarId, setAvatarId] = useState(account?.avatarId ?? AVATARS[0]!.id);
  const [country, setCountry] = useState<string | null>(account?.country ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ok = !!country;
  const returning = !!account?.country;

  // Pull the latest profile (wins / games played) from the server whenever the
  // screen opens, so stats reflect games finished since this device last synced.
  useEffect(() => {
    if (!account) return;
    let alive = true;
    api<PlayerProfile>('/api/v1/player/me', {
      headers: { Authorization: `Bearer ${account.token}` },
    })
      .then((fresh) => {
        if (!alive) return;
        const merged: Account = { ...fresh, token: account.token };
        saveAccount(merged);
        set({ account: merged });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    if (!ok || !account || busy) return;
    setBusy(true); setErr(null);
    try {
      const updated = await api<PlayerProfile>('/api/v1/player/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${account.token}` },
        body: JSON.stringify({ country, avatarId }),
      });
      const full: Account = { ...updated, token: account.token };
      saveAccount(full);
      set({ account: full, nickname: full.username, avatarId, appView: 'home' });
    } catch {
      setErr('تعذّر الحفظ، حاول مجدداً');
      setBusy(false);
    }
  }

  const header = (
    <div className="text-center">
      <h1 className="font-display text-3xl font-black text-desert-ink sm:text-4xl">
        أهلاً {account?.username}
      </h1>
      <p className="mt-1 font-display font-bold text-desert-ink/60">اختر صورتك ودولتك</p>
    </div>
  );

  return (
    <AuthShell
      onBrand={() => set({ appView: 'home' })}
      navAction={
        returning ? (
          <button onClick={() => set({ appView: 'home' })} className="inline-flex items-center gap-1 transition hover:opacity-80">
            <ChevronRight size={16} /> رجوع
          </button>
        ) : (
          <span>إكمال الحساب</span>
        )
      }
    >
      <AuthCard header={header}>
        {/* Wallet balance / buy-packages entry */}
        <button
          onClick={() => set({ appView: 'upgrade' })}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start text-white shadow-[0_14px_30px_-14px_rgba(214,90,20,0.8)] transition hover:brightness-105"
          style={{ backgroundImage: 'linear-gradient(135deg,#FBA94D,#EE5340)' }}
        >
          <Sparkles size={22} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-black sm:text-lg">
              {account?.credits
                ? `رصيدك: ${account.credits} ${account.credits === 1 ? 'لعبة' : 'ألعاب'}`
                : 'باقات الألعاب'}
            </span>
            <span className="block text-sm text-white/85">
              {account?.credits ? 'اشترِ المزيد — ٣٥ سؤالاً لكل لعبة' : '٣٥ سؤالاً + اختيار الفئات — اشترِ باقة'}
            </span>
          </span>
          <ChevronRight size={20} className="shrink-0 rotate-180" />
        </button>

        {/* Player record — games played + wins by mode (client request) */}
        <div className="mt-6">
          <p className="mb-2.5 text-right font-display font-bold text-white drop-shadow-sm">سجلّك</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile icon={Gamepad2} label="مرات اللعب" value={account?.gamesPlayed ?? 0} tone="#64748B" />
            <StatTile icon={Trophy} label="فوز بالنقاط" value={account?.pointsWins ?? 0} tone="#D97706" />
            <StatTile icon={Swords} label="فوز بالتصفيات" value={account?.eliminationWins ?? 0} tone="#DC2626" />
            <StatTile icon={Users} label="فوز بالفرق" value={account?.teamWins ?? 0} tone="#7C3AED" />
          </div>
        </div>

        {/* Avatar picker — square tiles, responsive grid */}
        <div className="mt-6">
          <p className="mb-2.5 text-right font-display font-bold text-white drop-shadow-sm">صورتك</p>
          <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-8">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatarId(a.id)}
                className="grid aspect-square place-items-center transition active:scale-90"
                aria-label={a.labelAr}
              >
                <Avatar avatarId={a.id} size={52} shape="square" selected={a.id === avatarId} />
              </button>
            ))}
          </div>
        </div>

        {/* Country picker */}
        <div className="mt-6">
          <p className="mb-2.5 text-right font-display font-bold text-white drop-shadow-sm">دولتك</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {COUNTRIES.map((c, i) => {
              const selected = country === c.code;
              const [from, to] = COUNTRY_TILES[i % COUNTRY_TILES.length]!;
              return (
                <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  aria-pressed={selected}
                  className={`group relative aspect-square overflow-hidden rounded-3xl shadow-card ring-1 ring-black/5 transition active:scale-95 ${selected ? 'ring-[3px] ring-[#E8473A]' : ''}`}
                  style={{ backgroundImage: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` }}
                >
                  {/* glossy top sheen */}
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
                  {/* big flag */}
                  <span className="absolute inset-x-0 top-[13%] grid place-items-center text-[2.4rem] leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,0.22)] sm:text-5xl">
                    {c.flag}
                  </span>
                  {/* name band */}
                  <span className="absolute inset-x-1.5 bottom-1.5 rounded-xl bg-white/92 px-1 py-1 text-center font-display text-xs font-black leading-tight text-desert-ink shadow-sm sm:text-sm">
                    {c.nameAr}
                  </span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#E8473A] text-white shadow-md">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {err && <p className="mt-4 text-center font-bold text-[#B3160B]">{err}</p>}

        <div className="mt-7">
          <CtaButton onClick={finish} disabled={!ok || busy}>
            {busy ? '…' : 'ابدأ'}
          </CtaButton>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

/** One stat in the player record: icon + big number + Arabic label. */
function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Trophy;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/85 px-2 py-3 text-center shadow-sm">
      <Icon size={20} style={{ color: tone }} />
      <span className="font-display text-2xl font-black text-desert-ink">{value}</span>
      <span className="text-xs font-bold leading-tight text-desert-ink/60">{label}</span>
    </div>
  );
}
