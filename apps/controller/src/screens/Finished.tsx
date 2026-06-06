import { motion } from 'framer-motion';
import { Crown, Medal } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';

export function Finished() {
  const { winner, participantId, myRank, myScore, locale } = useStore();
  const iWon = winner?.winner?.id === participantId;

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        className="flex flex-col items-center gap-5"
      >
        {iWon ? (
          <>
            <Crown size={96} className="text-prize-gold" style={{ filter: 'drop-shadow(0 0 24px rgba(245,197,24,0.8))' }} />
            <p className="font-display text-5xl font-black text-gold-gradient">{t(locale, 'congratulations')}</p>
            <p className="font-display text-3xl font-bold">{t(locale, 'champion')}</p>
          </>
        ) : (
          <>
            <Medal size={84} className="text-brand-cyan" />
            <p className="font-display text-4xl font-bold">{t(locale, 'gameOver')}</p>
            {myRank > 0 && <p className="text-2xl text-ink-secondary">{t(locale, 'rank')}: <b className="tnum text-ink-primary">#{myRank}</b></p>}
          </>
        )}
        <p className="text-xl text-ink-muted">{t(locale, 'score')}: <b className="tnum">{myScore}</b></p>
      </motion.div>
    </div>
  );
}
