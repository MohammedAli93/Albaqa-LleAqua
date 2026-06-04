import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';

/** Confetti burst via simple DOM particles (GPU transform/opacity only). */
function Confetti() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return null;
  const colors = ['#F5C518', '#7C3AED', '#22D3EE', '#C026D3', '#22C55E'];
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 80 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-3 w-3 rounded-sm"
          style={{ left: `${(i / 80) * 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (i % 5) * 0.4, repeat: Infinity, delay: (i % 10) * 0.15, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function Winner() {
  const { winner, locale } = useStore();
  useEffect(() => {
    // could trigger sound here
  }, []);

  if (!winner) return null;
  const champ = winner.winner;
  const team = winner.winnerTeam;

  return (
    <div className="relative grid h-full place-items-center bg-gradient-stage">
      <Confetti />
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
            <p className="tnum font-display text-4xl font-bold">{champ.score} {t(locale, 'score')}</p>
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
            <p className="tnum font-display text-4xl font-bold">{team.score} {t(locale, 'score')}</p>
          </>
        )}

        <p className="mt-4 font-display text-5xl font-bold text-gradient animate-pulse-glow">
          {t(locale, 'congratulations')}
        </p>
      </motion.div>
    </div>
  );
}
