import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DESERT AUTH SHELL — pixel-faithful rebuild of the Figma "Login" comp
 *  (Assets/Login/بقاء الأقوى1 5·6·7). One gold desert plate (login-bg.jpg, the
 *  rider + luggage left, drum right), a black top nav, and a centred orange card
 *  (Figma "Group 176" gradient). The card body — segmented دخول/حساب جديد toggle,
 *  cream inputs, coral CTA, blue code pill, avatar grid — is recreated in CSS so
 *  it stays crisp and interactive. Shared by Login (screens 5·6) and Join (7).
 * ════════════════════════════════════════════════════════════════════════════
 */

const GOLD = '#F4C73C';
export const CORAL_BTN = 'linear-gradient(180deg,#F2796C 0%,#E8473A 100%)';
export const BLUE_BTN = 'linear-gradient(180deg,#5BBDEE 0%,#2E97D4 100%)';
const CARD_BG = 'linear-gradient(180deg,#FCA01D 0%,#FDBE4E 38%,#FEE0A8 78%,#FFEEC8 100%)';

/** Full desert page: bg plate + black navbar + centred card slot. */
export function AuthShell({
  children,
  onBrand,
  navAction,
}: {
  children: ReactNode;
  /** Brand wordmark tap (→ home). */
  onBrand?: () => void;
  /** Optional left-side nav control (e.g. تسجيل الدخول / رجوع). */
  navAction?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-desert-night">
      {/* gold desert plate — rider/luggage left, drum right (Figma background) */}
      <img
        src="/art/login-bg.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-bottom"
      />

      {/* black top navbar — brand on the right (RTL start), action on the left */}
      <header className="relative z-10 bg-desert-night">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-3 lg:px-8">
          <button
            onClick={onBrand}
            className="font-display text-base font-extrabold tracking-wide transition hover:opacity-80 lg:text-lg"
            style={{ color: GOLD }}
          >
            البقاء للأقوى
          </button>
          <div className="font-display text-sm font-bold lg:text-base" style={{ color: GOLD }}>
            {navAction}
          </div>
        </div>
      </header>

      {/* centred card — min-h-full keeps it centred when short, scrolls when tall
          (so the profile's avatar + country grids never get clipped on a phone) */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-5 py-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Orange card panel (Figma "Group 176"). Defaults to the logo + subtitle header;
 *  pass `header` to replace it (e.g. the profile greeting). */
export function AuthCard({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 230, damping: 24 }}
      className="w-full max-w-[460px] rounded-[1.9rem] px-6 pb-8 pt-7 shadow-[0_40px_90px_-40px_rgba(180,90,10,0.85)] ring-1 ring-white/40 sm:px-8"
      style={{ backgroundImage: CARD_BG }}
    >
      {header ?? (
        <>
          <img
            src="/art/logo-wordmark.png"
            alt="البقاء للأقوى"
            className="mx-auto h-auto w-[11rem] drop-shadow-sm sm:w-[12.5rem]"
          />
          <p className="mt-1.5 text-center font-display text-lg font-extrabold text-desert-ink sm:text-xl">
            برنامج المسابقات الأول
          </p>
        </>
      )}
      {children}
    </motion.div>
  );
}

/** Segmented دخول / حساب جديد toggle (RTL: register right, login left). */
export function SegTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div
      className="mx-auto mt-5 flex w-[16rem] rounded-full p-1 shadow-inner"
      style={{ backgroundImage: 'linear-gradient(180deg,#FFD23A 0%,#FFBE1C 100%)' }}
    >
      {tabs.map((tb) => {
        const active = tb.key === value;
        return (
          <button
            key={tb.key}
            onClick={() => onChange(tb.key)}
            className={[
              'relative flex-1 rounded-full py-2 font-display text-sm font-extrabold transition sm:text-base',
              active ? 'text-white' : 'text-desert-ink/70 hover:text-desert-ink',
            ].join(' ')}
          >
            {active && (
              <motion.span
                layoutId="seg-active"
                className="absolute inset-0 rounded-full shadow-[0_6px_16px_-6px_rgba(214,58,34,0.8)]"
                style={{ backgroundImage: CORAL_BTN }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tb.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Labelled cream input (label is white, right-aligned, above the field). */
export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-right font-display font-bold text-white drop-shadow-sm">{label}</label>
      {children}
    </div>
  );
}

export const authInputCls =
  'w-full rounded-2xl bg-[#FDF0CC] px-5 py-3.5 text-lg text-desert-ink shadow-[inset_0_2px_4px_rgba(180,120,20,0.18)] outline-none transition placeholder:text-desert-ink/35 focus:bg-white focus:ring-2 focus:ring-[#E8473A]';

/** Coral / blue pill CTA. */
export function CtaButton({
  children,
  onClick,
  disabled,
  variant = 'coral',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'coral' | 'blue';
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      onClick={onClick}
      disabled={disabled}
      className="mx-auto block rounded-full px-12 py-3 font-display text-lg font-bold text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] transition disabled:opacity-40"
      style={{ backgroundImage: variant === 'blue' ? BLUE_BTN : CORAL_BTN }}
    >
      {children}
    </motion.button>
  );
}
