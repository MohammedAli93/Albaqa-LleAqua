/**
 * Ambient game-show atmosphere: slow-drifting pastel aurora blobs + a soft stage
 * glow on the light canvas. Fixed behind all content. Pure CSS animation (GPU
 * transforms), so it's cheap and respects reduced-motion.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg-base">
      <div className="absolute -left-24 -top-24 h-[55vh] w-[55vh] rounded-full bg-brand-violet/20 blur-[110px] animate-aurora" />
      <div className="absolute -right-24 top-1/4 h-[48vh] w-[48vh] rounded-full bg-action/15 blur-[120px] animate-aurora-slow" />
      <div className="absolute bottom-[-10%] left-1/3 h-[50vh] w-[50vh] rounded-full bg-brand-cyan/15 blur-[130px] animate-aurora" />
      {/* soft stage spotlight from the top */}
      <div className="absolute inset-0 bg-gradient-stage" />
      {/* a faint top-to-bottom wash to keep the canvas airy */}
      <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(255,255,255,0.4)_0%,transparent_30%)]" />
    </div>
  );
}
