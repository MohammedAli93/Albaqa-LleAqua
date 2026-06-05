import { motion } from 'framer-motion';

const COLORS = ['#F59E0B', '#4F46E5', '#14B8A6', '#FB7185', '#22C55E', '#7C3AED'];

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** One-shot radial confetti burst from the center (e.g. correct answer reveal). */
export function ConfettiBurst({ count = 64 }: { count?: number }) {
  if (reducedMotion()) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 grid place-items-center overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count + (i % 3) * 0.25;
        const dist = 220 + (i % 6) * 55;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return (
          <motion.span
            key={i}
            className="absolute h-2.5 w-2.5 rounded-sm"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y: y + 240, opacity: [1, 1, 0], rotate: 540 }}
            transition={{ duration: 1.5 + (i % 4) * 0.25, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

/** Continuous falling confetti rain (e.g. the winner screen). */
export function ConfettiRain({ count = 80 }: { count?: number }) {
  if (reducedMotion()) return null;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-3 rounded-sm"
          style={{ left: `${(i / count) * 100}%`, background: COLORS[i % COLORS.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (i % 5) * 0.4, repeat: Infinity, delay: (i % 10) * 0.15, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
