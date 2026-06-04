import { motion } from 'framer-motion';
import { Users, Swords, ListOrdered, Crown, ChevronLeft, type LucideIcon } from 'lucide-react';
import { useStore } from '../../store.js';

/**
 * Mode picker. Group/party (big screen + scan to join) is fully wired via join-by-
 * code. The phone-hosted modes (any-vs-any, League, Cup as a direct match) need
 * the create-match backend (next step); for now they route into join-by-code.
 */
const MODES: { key: string; icon: LucideIcon; title: string; desc: string; tint: string }[] = [
  { key: 'group', icon: Users, title: 'المجموعة', desc: 'شاشة كبيرة، والكل ينضمّ بمسح الكود', tint: 'from-brand-cyan/30 text-brand-cyan shadow-glow-cyan' },
  { key: 'versus', icon: Swords, title: 'تحدٍّ — أي عدد ضد أي عدد', desc: 'فريق ضد فريق: ١×١، ٢×٢، أو أكثر', tint: 'from-action/30 text-action shadow-glow-rose' },
  { key: 'league', icon: ListOrdered, title: 'الدوري', desc: '٢٠–٣٠ جولة، الأسرع يأخذ نقاطاً أكثر', tint: 'from-brand-violet/30 text-brand-violet shadow-glow' },
  { key: 'cup', icon: Crown, title: 'الكأس', desc: '٣ أرواح، والبقاء للأقوى', tint: 'from-prize-gold/30 text-prize-gold shadow-gold' },
];

export function Play() {
  const { set } = useStore();
  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      <button onClick={() => set({ appView: 'home' })} className="flex items-center gap-1 self-start text-ink-secondary">
        <ChevronLeft size={20} /> رجوع
      </button>
      <h1 className="mt-4 font-display text-3xl font-black">اختر طريقة اللعب</h1>

      <div className="mt-6 space-y-3">
        {MODES.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.key}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
              whileTap={{ scale: 0.97 }}
              onClick={() => set({ appView: 'game', phase: 'join' })}
              className={`relative flex w-full items-center gap-4 overflow-hidden rounded-xl3 border border-white/10 bg-gradient-to-l ${m.tint} to-transparent p-5 text-start`}
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <Icon size={26} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-xl font-extrabold text-ink-primary">{m.title}</span>
                <span className="block text-sm text-ink-secondary">{m.desc}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-7 text-center text-sm leading-relaxed text-ink-muted">
        للّعب الجماعي افتح الشاشة الكبيرة وامسح الكود — أو انضمّ بكود من صديقك.
      </p>
    </div>
  );
}
