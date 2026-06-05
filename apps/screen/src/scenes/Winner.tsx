import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';
import { ConfettiRain } from '../components/Confetti.js';

/** Eased count-up number for the dramatic final score reveal. */
function CountUp({ value, className }: { value: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{n}</span>;
}

export function Winner() {
  const { winner, locale } = useStore();

  if (!winner) return null;
  const champ = winner.winner;
  const team = winner.winnerTeam;

  return (
    <div className="relative grid h-full place-items-center bg-gradient-stage">
      <ConfettiRain />
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
          <Crown size={120} className="text-prize-gold" style={{ filter: 'drop-shadow(0 0 30px rgba(245,197,24,0.8))' }} />
        </motion.div>
        <p className="font-display text-4xl font-bold text-ink-secondary">{t(locale, 'champion')}</p>

        {champ && (
          <>
            <div className="scale-150">
              <Avatar avatarId={champ.avatarId} size={120} />
            </div>
            <h1 className="font-display text-8xl font-black text-gold-gradient">{champ.nickname}</h1>
            <p className="tnum font-display text-4xl font-bold"><CountUp value={champ.score} /> {t(locale, 'score')}</p>
          </>
        )}
        {team && (
          <>
            <div
              className="grid h-28 w-28 place-items-center rounded-full shadow-gold"
              style={{ background: team.color }}
            >
              <Crown color="white" size={56} />
            </div>
            <h1 className="font-display text-7xl font-black" style={{ color: team.color }}>{team.name}</h1>
            <p className="tnum font-display text-4xl font-bold"><CountUp value={team.score} /> {t(locale, 'score')}</p>
          </>
        )}

        <p className="mt-4 font-display text-5xl font-bold text-gradient animate-pulse-glow">
          {t(locale, 'congratulations')}
        </p>
      </motion.div>
    </div>
  );
}
