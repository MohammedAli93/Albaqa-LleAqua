/**
 * Big-screen background plate (Figma desert comp). Two painted scenes:
 *   • 'team' — orange dunes + camel caravan (Assets/Login بقاء الأقوى1 9) — used
 *     while hosting a TEAMS game (setup + lobby).
 *   • 'sky'  — blue cloud valley (بقاء الأقوى1 14) — used for gameplay (question,
 *     scoreboard, winner) and the neutral connecting/individual screens.
 * Sits behind the scene content; an optional scrim keeps text readable.
 */
export function HostBg({ variant = 'sky' }: { variant?: 'sky' | 'team' }) {
  const src = variant === 'team' ? '/art/host-bg-team.jpg' : '/art/host-bg-sky.jpg';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img src={src} alt="" className="h-full w-full select-none object-cover object-bottom" />
      {/* gentle top scrim so the black nav / pills / titles stay crisp */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'team'
              ? 'linear-gradient(180deg, rgba(255,247,235,0.35) 0%, rgba(255,247,235,0) 35%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 40%)',
        }}
      />
    </div>
  );
}
