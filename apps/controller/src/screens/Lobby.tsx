import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';
import { Avatar } from '../components/Avatar.js';

export function Lobby() {
  const { nickname, avatarId, locale } = useStore();
  return (
    <div className="grid min-h-full place-items-center px-6 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
        <Avatar avatarId={avatarId} size={120} selected />
        <p className="font-display text-4xl font-bold" dir="auto">{nickname}</p>
        <div className="flex items-center gap-3 text-xl text-ink-secondary">
          <Loader2 className="animate-spin" />
          {t(locale, 'waitingForPlayers')}
        </div>
      </motion.div>
    </div>
  );
}
