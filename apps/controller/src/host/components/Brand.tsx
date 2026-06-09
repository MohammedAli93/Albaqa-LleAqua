import { t } from '@tahaddi/i18n';
import { useStore } from '../store.js';

/**
 * Consistent branding mark for the host display — shown in a fixed corner across
 * the game scenes so the game name stays recognizable on TV/projector throughout
 * the experience (not just on the lobby).
 */
export function Brand({ className = '' }: { className?: string }) {
  const { locale } = useStore();
  return (
    <span
      className={`pointer-events-none inline-flex items-center gap-2 font-display text-screen-brand font-black ${className}`}
    >
      <span className="grid h-[1.4em] w-[1.4em] place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
        <span className="text-[0.7em] leading-none">★</span>
      </span>
      <span className="text-gradient">{t(locale, 'appName')}</span>
    </span>
  );
}
