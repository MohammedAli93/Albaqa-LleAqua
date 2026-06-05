/** Circular countdown. Smoothly interpolates remaining/total; turns amber→red as
 *  time runs low. The numeric value uses tabular figures so it doesn't jitter. */
import { motion } from 'framer-motion';

export function CountdownRing({
  remainingMs,
  totalMs,
  size = 160,
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
}) {
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const seconds = Math.ceil(remainingMs / 1000);
  const color = pct > 0.5 ? '#14B8A6' : pct > 0.25 ? '#F59E0B' : '#EF4444';
  const low = pct <= 0.25;

  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      animate={low ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={low ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(15,23,42,0.10)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ ease: 'linear', duration: 0.25 }}
          style={{ filter: `drop-shadow(0 0 14px ${color})` }}
        />
      </svg>
      <span className="tnum absolute font-display text-5xl font-black" style={{ color }}>
        {seconds}
      </span>
    </motion.div>
  );
}
