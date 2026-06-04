import { motion } from 'framer-motion';
import { Users, Swords, ListOrdered, Crown } from 'lucide-react';
import { useStore } from '../../store.js';

/**
 * Mode picker. Group/party (big screen + scan to join) is fully wired via the
 * join-by-code path. The phone-hosted modes (1v1 / any-vs-any, League, Cup as a
 * direct match) need the matchmaking/create-match backend — next step — so for
 * now they route into the working join-by-code flow.
 */
const MODES = [
  { key: 'group', icon: Users, title: 'المجموعة', desc: 'شاشة كبيرة، والكل ينضمّ بمسح الكود من جواله' },
  { key: 'versus', icon: Swords, title: 'تحدٍّ — أي عدد ضد أي عدد', desc: 'فريق ضد فريق: 1×1، 2×2، أو أكثر' },
  { key: 'league', icon: ListOrdered, title: 'الدوري', desc: '٢٠–٣٠ جولة، أول من يجاوب يأخذ نقاط أكثر' },
  { key: 'cup', icon: Crown, title: 'الكأس', desc: '٣ أرواح، الخطأ يخسر روح، والبقاء للأقوى' },
] as const;

export function Play() {
  const { set } = useStore();
  return (
    <div className="flex min-h-screen flex-col px-5 py-6">
      <button onClick={() => set({ appView: 'home' })} className="self-start text-ink-secondary">← رجوع</button>
      <h1 className="mt-4 font-display text-3xl font-bold">اختر طريقة اللعب</h1>

      <div className="mt-6 space-y-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => set({ appView: 'game', phase: 'join' })}
              className="glass flex w-full items-center gap-4 rounded-xl2 p-4 text-start"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl2 bg-brand-violet/25 text-brand-violet">
                <Icon size={24} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-xl font-bold">{m.title}</span>
                <span className="block text-sm text-ink-secondary">{m.desc}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        للّعب الجماعي: افتح الشاشة الكبيرة وامسح الكود — أو انضمّ بكود من صديقك.
      </p>
    </div>
  );
}
