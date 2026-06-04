import {
  Bird, Cat, Rocket, Crown, Zap, Flame, Star, Gem, Dog, Glasses, Ghost,
  Shield, Anchor, Leaf, Moon, Sun, User, type LucideIcon,
} from 'lucide-react';
import { getAvatar } from '@tahaddi/shared';

const ICONS: Record<string, LucideIcon> = {
  bird: Bird, cat: Cat, rocket: Rocket, crown: Crown, zap: Zap, flame: Flame,
  star: Star, gem: Gem, dog: Dog, glasses: Glasses, ghost: Ghost, shield: Shield,
  anchor: Anchor, leaf: Leaf, moon: Moon, sun: Sun,
};

export function Avatar({ avatarId, size = 56, selected = false }: { avatarId: string; size?: number; selected?: boolean }) {
  const def = getAvatar(avatarId);
  const Icon = (def && ICONS[def.icon]) ?? User;
  const [from, to] = def?.gradient ?? ['#7C3AED', '#C026D3'];
  return (
    <div
      className={`grid place-items-center rounded-full transition ${selected ? 'ring-4 ring-prize-gold scale-105' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-label={def?.labelAr ?? 'player'}
    >
      <Icon color="white" size={size * 0.5} strokeWidth={2.2} />
    </div>
  );
}
