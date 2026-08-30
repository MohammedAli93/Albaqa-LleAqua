import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { leaveRoom } from '../socket.js';
import { GameShell, Pill } from '../components/desert.js';

/** Loss / elimination screen (reference screen 22). */
export function Eliminated() {
  const { myRank, locale, set, resetGame } = useStore();
  return (
    <GameShell className="items-center justify-center px-6 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        >
          <Heart
            size={132}
            className="text-[#F2685B]"
            fill="currentColor"
            strokeWidth={0}
            style={{ filter: 'drop-shadow(0 16px 30px rgba(224,57,44,0.45))' }}
          />
        </motion.div>
        <h1
          className="max-w-[18ch] font-display text-4xl font-black text-[#F2685B]"
          style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.25))' }}
        >
          {t(locale, 'betterLuck')}
        </h1>
        {myRank > 0 && (
          <Pill color="green" className="px-8 py-2.5 text-lg">{t(locale, 'yourRank', { rank: myRank })}</Pill>
        )}
      </div>

      {/* Watch the rest on the big screen, or step out — either way, don't leave
          the phone with no way forward (client 2026-08-30). */}
      <div className="w-full max-w-md pb-6">
        <button
          onClick={() => {
            leaveRoom();
            resetGame();
            set({ appView: 'home' });
          }}
          className="w-full rounded-2xl bg-white/85 py-3.5 font-display text-base font-black text-desert-ink"
        >
          {t(locale, 'backHome')}
        </button>
      </div>
    </GameShell>
  );
}
