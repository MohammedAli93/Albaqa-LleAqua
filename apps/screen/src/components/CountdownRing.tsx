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
  const color = pct > 0.5 ? '#22D3EE' : pct > 0.25 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
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
          style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <span className="tnum absolute font-display text-5xl font-bold" style={{ color }}>
        {seconds}
      </span>
    </div>
  );
}
