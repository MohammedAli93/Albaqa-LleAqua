import { motion } from 'framer-motion';
import { Sparkles, ScanLine } from 'lucide-react';
import { useStore } from '../../store.js';

export function Splash() {
  const { set } = useStore();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mt-4 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-ink-secondary"
      >
        <span className="h-2 w-2 rounded-full bg-action animate-pulse-glow" /> برنامج المسابقات الأول
      </motion.div>

      {/* Hero wordmark */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 190, damping: 16 }}
          className="relative"
        >
          <div className="absolute inset-0 -z-10 rounded-[40%] bg-brand-violet/30 blur-3xl animate-pulse-glow" />
          <h1 className="font-display text-[5.5rem] font-black leading-[1.12] text-gradient text-glow pb-2">
            البقاء
            <br />
            للأقوى
          </h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-6 max-w-xs text-lg leading-relaxed text-ink-secondary"
        >
          تحدَّ أصحابك في أقوى لعبة أسئلة ثقافية — والبقاء للأقوى.
        </motion.p>
      </div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => set({ appView: 'login' })}
          className="btn-cta flex w-full items-center justify-center gap-2 rounded-2xl py-5 text-2xl animate-glow-pulse"
        >
          <Sparkles size={24} /> ابدأ اللعب
        </motion.button>
        <button
          onClick={() => set({ appView: 'game', phase: 'join' })}
          className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold text-ink-secondary"
        >
          <ScanLine size={18} /> عندك كود؟ انضمّ مباشرة
        </button>
      </motion.div>
    </div>
  );
}
