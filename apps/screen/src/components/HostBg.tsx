/**
 * Big-screen background plate (desert comp). 'sky' = blue cloud valley for
 * gameplay/winner; 'team' = warm orange dunes for team standings. A gentle top
 * scrim keeps titles/pills crisp.
 */
export function HostBg({ variant = 'sky' }: { variant?: 'sky' | 'team' }) {
  const src = variant === 'team' ? '/art/host-bg-team.jpg' : '/art/host-bg-sky.jpg';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img src={src} alt="" className="h-full w-full select-none object-cover object-bottom" />
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
