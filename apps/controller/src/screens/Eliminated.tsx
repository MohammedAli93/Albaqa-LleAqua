import { motion } from 'framer-motion';
import { Skull } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';

export function Eliminated() {
  const { myRank, myScore, locale } = useStore();
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5"
      >
        <motion.div initial={{ rotate: -10 }} animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.6 }}>
          <Skull size={96} className="text-danger" />
        </motion.div>
        <p className="font-display text-5xl font-black text-danger">{t(locale, 'eliminated')}</p>
        {myRank > 0 && (
          <p className="text-2xl text-ink-secondary">
            {t(locale, 'rank')}: <b className="tnum text-ink-primary">#{myRank}</b>
          </p>
        )}
        <p className="text-xl text-ink-muted">{t(locale, 'score')}: <b className="tnum">{myScore}</b></p>
      </motion.div>
    </div>
  );
}
