import { Heart } from 'lucide-react';

/** Lives as hearts: ❤️ for remaining, 🤍 for lost. Used in elimination mode. */
export function Hearts({ lives, max = 3, size = 28 }: { lives: number; max?: number; size?: number }) {
  const safe = Math.max(0, Math.min(max, lives));
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${safe}/${max}`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < safe;
        return (
          <Heart
            key={i}
            size={size}
            className={filled ? 'text-danger' : 'text-ink-muted/25'}
            fill={filled ? 'currentColor' : 'none'}
            strokeWidth={filled ? 0 : 2}
          />
        );
      })}
    </span>
  );
}
