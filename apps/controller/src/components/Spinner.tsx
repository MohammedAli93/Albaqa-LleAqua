import { motion } from 'framer-motion';

/**
 * Elegant branded loading spinner — a smooth gradient ring.
 * Used for in-app loading states (connecting, joining, waiting) in place of
 * heavy page-to-page motion. Respects reduced-motion via the global MotionConfig.
 */
export function Spinner({
  size = 40,
  label,
  className = '',
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        {/* Soft glow behind the ring */}
        <span className="absolute inset-0 rounded-full bg-brand-violet/25 blur-md" />
        <motion.span
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: 'conic-gradient(from 0deg, transparent 0%, var(--brand-deep, #4F46E5) 85%, transparent 100%)',
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${Math.max(3, size * 0.11)}px), #000 0)`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${Math.max(3, size * 0.11)}px), #000 0)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
        />
      </span>
      {label && <p className="text-lg font-semibold text-ink-secondary">{label}</p>}
    </div>
  );
}
