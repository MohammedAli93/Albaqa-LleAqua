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
    <div className="relative grid min-h-dvh place-items-center bg-gradient-stage p-5 lg:h-full lg:p-0">
      <ConfettiRain />
      <motion.div
        initial={{ scale: 0.6, opacity: 0, y: 60 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        className="flex w-full max-w-3xl flex-col items-center gap-4 text-center lg:gap-6"
      >
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
          <Crown className="h-20 w-20 text-prize-gold lg:h-[7.5rem] lg:w-[7.5rem]" style={{ filter: 'drop-shadow(0 0 30px rgba(245,197,24,0.8))' }} />
        </motion.div>
        <p className="font-display text-2xl font-bold text-ink-secondary lg:text-4xl">{t(locale, 'champion')}</p>

        {champ && (
          <>
            <div className="scale-100 lg:scale-150">
              <Avatar avatarId={champ.avatarId} size={120} />
            </div>
            <h1 className="max-w-full break-words font-display text-5xl font-black text-gold-gradient lg:text-8xl">{champ.nickname}</h1>
            <p className="tnum font-display text-2xl font-bold lg:text-4xl"><CountUp value={champ.score} /> {t(locale, 'score')}</p>
          </>
        )}
        {team && (
          <>
            <div
              className="grid h-20 w-20 place-items-center rounded-full shadow-gold lg:h-28 lg:w-28"
              style={{ background: team.color }}
            >
              <Crown color="white" className="h-10 w-10 lg:h-14 lg:w-14" />
            </div>
            <h1 className="max-w-full break-words font-display text-4xl font-black lg:text-7xl" style={{ color: team.color }}>{team.name}</h1>
            <p className="tnum font-display text-2xl font-bold lg:text-4xl"><CountUp value={team.score} /> {t(locale, 'score')}</p>
          </>
        )}

        <p className="mt-2 font-display text-3xl font-bold text-gradient animate-pulse-glow lg:mt-4 lg:text-5xl">
          {t(locale, 'congratulations')}
        </p>
      </motion.div>
    </div>
  );
}
