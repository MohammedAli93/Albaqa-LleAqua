import { motion } from 'framer-motion';
import { t } from '@tahaddi/i18n';
import { useStore } from '../../store.js';

export function Splash() {
  const { locale, set } = useStore();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 text-center">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-6xl font-black text-gradient"
        >
          {t(locale, 'appName')}
        </motion.h1>
        <p className="mt-3 text-lg text-ink-secondary">لعبة الأسئلة الثقافية</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => set({ appView: 'login' })}
          className="w-full rounded-2xl bg-gradient-brand py-5 font-display text-2xl font-bold shadow-glow"
        >
          تسجيل الدخول / حساب جديد
        </motion.button>
        <button
          onClick={() => set({ appView: 'game', phase: 'join' })}
          className="w-full rounded-2xl glass py-4 text-xl font-semibold text-ink-secondary"
        >
          عندك كود؟ انضمّ للعبة
        </button>
      </div>
    </div>
  );
}
