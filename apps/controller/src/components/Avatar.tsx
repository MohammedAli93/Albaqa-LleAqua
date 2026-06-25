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

export function Avatar({
  avatarId,
  size = 56,
  selected = false,
  shape = 'circle',
}: {
  avatarId: string;
  size?: number;
  selected?: boolean;
  /** 'square' renders the rounded-tile look from the join/login comp. */
  shape?: 'circle' | 'square';
}) {
  const def = getAvatar(avatarId);
  const Icon = (def && ICONS[def.icon]) ?? User;
  const [from, to] = def?.gradient ?? ['#7C3AED', '#C026D3'];
  const square = shape === 'square';
  const radius = square ? 'rounded-[26%]' : 'rounded-full';
  // Glossy squircle tile (new desert design): soft top sheen + warm drop shadow.
  const tileShadow = square
    ? 'shadow-[0_12px_24px_-10px_rgba(0,0,0,0.45),inset_0_2px_2px_rgba(255,255,255,0.45)]'
    : '';
  return (
    <div
      className={`grid place-items-center transition ${radius} ${tileShadow} ${selected ? 'ring-4 ring-prize-gold scale-105' : ''}`}
      style={{ width: size, height: size, background: `linear-gradient(160deg, ${from}, ${to})` }}
      aria-label={def?.labelAr ?? 'player'}
    >
      <Icon color="white" size={size * 0.52} strokeWidth={2.2} />
    </div>
  );
}
