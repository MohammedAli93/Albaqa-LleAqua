/**
 * Ambient game-show atmosphere: slow-drifting neon aurora blobs + stage glow +
 * fine grain. Fixed behind all content. Pure CSS animation (GPU transforms), so
 * it's cheap and respects reduced-motion via the media query below.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg-base">
      <div className="absolute -left-24 -top-24 h-[55vh] w-[55vh] rounded-full bg-brand-violet/30 blur-[100px] animate-aurora" />
      <div className="absolute -right-24 top-1/4 h-[48vh] w-[48vh] rounded-full bg-brand-magenta/25 blur-[110px] animate-aurora-slow" />
      <div className="absolute bottom-[-10%] left-1/3 h-[50vh] w-[50vh] rounded-full bg-brand-cyan/20 blur-[120px] animate-aurora" />
      {/* stage spotlight from the top */}
      <div className="absolute inset-0 bg-gradient-stage" />
      {/* fine grain for premium texture */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:3px_3px]" />
      {/* vignette */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,rgba(5,3,9,0.7)_100%)]" />
    </div>
  );
}
