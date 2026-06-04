/**
 * Shared Tailwind preset — "البقاء للأقوى" design system v2.
 * Direction: premium retro-futurist game-show. Deep-space canvas, electric-violet
 * → magenta brand, neon accents, rose action, gold prize. Arabic-first (Cairo
 * display / Tajawal body). Consumed by apps/screen, apps/controller, apps/admin.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canvas — deep violet-black with layered surfaces
        bg: { base: '#0A0712', raised: '#150E29', sunken: '#050309', overlay: '#1E1340' },
        // Brand spectrum
        brand: { violet: '#8B5CF6', deep: '#6D28D9', indigo: '#6366F1', magenta: '#D946EF', cyan: '#22D3EE' },
        // Action (CTA) — electric rose
        action: { DEFAULT: '#F43F5E', hot: '#FB7185' },
        // Neon accents
        neon: { pink: '#F472B6', lime: '#A3E635', cyan: '#22D3EE' },
        // Prize / winner
        prize: { gold: '#FACC15', deep: '#CA8A04' },
        // Text
        ink: { primary: '#F8F6FF', secondary: '#BCB6DC', muted: '#7C7699' },
        // States
        success: '#34D399', danger: '#FB7185', warning: '#FBBF24', info: '#38BDF8',
        // Answer-option palette (game-show 4-up)
        opt: { a: '#F43F5E', b: '#22D3EE', c: '#A855F7', d: '#FACC15' },
      },
      fontFamily: {
        display: ['Cairo', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        body: ['Tajawal', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem', xl4: '2.25rem' },
      boxShadow: {
        glass: '0 10px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        glow: '0 0 50px -8px rgba(139,92,246,0.7)',
        'glow-cyan': '0 0 50px -8px rgba(34,211,238,0.65)',
        'glow-rose': '0 0 50px -6px rgba(244,63,94,0.65)',
        gold: '0 0 55px -6px rgba(250,204,21,0.65)',
        card: '0 24px 70px -24px rgba(0,0,0,0.75)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
        'gradient-action': 'linear-gradient(135deg, #FB7185 0%, #F43F5E 55%, #E11D48 100%)',
        'gradient-prize': 'linear-gradient(135deg, #FDE047 0%, #FACC15 50%, #CA8A04 100%)',
        'gradient-cyber': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 45%, #22D3EE 100%)',
        'gradient-stage': 'radial-gradient(ellipse 80% 55% at 50% -8%, rgba(139,92,246,0.45) 0%, rgba(10,7,18,0) 62%)',
        'gradient-card': 'linear-gradient(160deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 100%)',
      },
      keyframes: {
        'gradient-pan': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'pulse-glow': { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        aurora: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(8%,-6%) scale(1.15)' },
          '66%': { transform: 'translate(-6%,7%) scale(0.92)' },
        },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pop: { '0%': { transform: 'scale(0.85)', opacity: '0' }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'glow-pulse': { '0%,100%': { boxShadow: '0 0 30px -10px rgba(139,92,246,0.6)' }, '50%': { boxShadow: '0 0 55px -6px rgba(139,92,246,0.9)' } },
      },
      animation: {
        'gradient-pan': 'gradient-pan 8s ease infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        aurora: 'aurora 18s ease-in-out infinite',
        'aurora-slow': 'aurora 27s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        pop: 'pop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'glow-pulse': 'glow-pulse 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
