/**
 * Shared Tailwind preset — "البقاء للأقوى" design system v3 (light).
 * Direction: bright, premium, friendly game-show. Light sky/lavender canvas,
 * indigo brand, teal + coral accents, amber prizes, strong contrast. Arabic-first
 * (Cairo display / Tajawal body). Consumed by apps/screen, apps/controller, apps/admin.
 *
 * Token names are kept stable across the dark→light redesign so existing utility
 * classes (bg-base, text-ink-primary, bg-brand-deep, shadow-glow, bg-gradient-brand…)
 * automatically adopt the new palette.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Canvas — light sky/lavender page with white raised surfaces
        bg: { base: '#F4F7FF', raised: '#FFFFFF', sunken: '#E8EEFC', overlay: '#FFFFFF' },
        // Brand spectrum — indigo led, violet pop, teal accent
        brand: { violet: '#6366F1', deep: '#4F46E5', indigo: '#4F46E5', magenta: '#7C3AED', cyan: '#14B8A6' },
        // Action (CTA) — coral → rose
        action: { DEFAULT: '#F43F5E', hot: '#FB7185' },
        // Accents (kept under the old "neon" key for class compatibility)
        neon: { pink: '#F472B6', lime: '#10B981', cyan: '#14B8A6' },
        // Prize / winner — warm amber
        prize: { gold: '#F59E0B', deep: '#B45309' },
        // Text — dark slate on light surfaces
        ink: { primary: '#0F172A', secondary: '#475569', muted: '#94A3B8' },
        // States
        success: '#10B981', danger: '#EF4444', warning: '#F59E0B', info: '#0EA5E9',
        // Answer-option palette (game-show 4-up) — distinct & accessible on light
        opt: { a: '#4F46E5', b: '#14B8A6', c: '#F59E0B', d: '#FB7185' },
      },
      fontFamily: {
        display: ['Cairo', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        body: ['Tajawal', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      // ── Responsive typography scale (big-screen / host display) ──────────────
      // Fluid clamp() tokens: one class scales smoothly from phone → projector →
      // 75" TV, with min/max caps so desktop & tablet stay balanced. Intended for
      // the full-viewport `apps/screen` host display (do NOT use in the phone
      // controller — its constrained column makes vw units misbehave).
      // Arabic glyphs hang below the baseline, so word tokens get generous
      // line-height (≥1.3) to avoid clipped descenders inside truncate/overflow.
      // Number tokens (score/ranknum/code/timer — digits only) stay tight.
      fontSize: {
        'screen-brand': ['clamp(1rem, 1.4vw, 1.75rem)', { lineHeight: '1.3' }],
        'screen-meta': ['clamp(0.95rem, 1.35vw, 1.6rem)', { lineHeight: '1.35' }],
        'screen-status': ['clamp(1.1rem, 1.7vw, 1.9rem)', { lineHeight: '1.35' }],
        'screen-timer': ['clamp(1.25rem, 1.9vw, 2.15rem)', { lineHeight: '1' }],
        'screen-answer': ['clamp(1.15rem, 1.9vw, 2.2rem)', { lineHeight: '1.35' }],
        'screen-rankname': ['clamp(1.2rem, 1.8vw, 2rem)', { lineHeight: '1.35' }],
        'screen-ranknum': ['clamp(1.5rem, 2.2vw, 2.75rem)', { lineHeight: '1' }],
        'screen-score': ['clamp(1.6rem, 2.5vw, 3rem)', { lineHeight: '1' }],
        'screen-team': ['clamp(1.5rem, 2.7vw, 3.25rem)', { lineHeight: '1.4' }],
        'screen-question': ['clamp(1.6rem, 3.1vw, 3.5rem)', { lineHeight: '1.3' }],
        'screen-title': ['clamp(1.75rem, 3.3vw, 4rem)', { lineHeight: '1.3' }],
        'screen-code': ['clamp(2.75rem, 7.5vw, 7.5rem)', { lineHeight: '1' }],
        'screen-name': ['clamp(2.25rem, 6vw, 6.5rem)', { lineHeight: '1.3' }],
        'screen-champion': ['clamp(3rem, 9vw, 9.5rem)', { lineHeight: '1.22' }],
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem', xl4: '2.25rem' },
      boxShadow: {
        // Soft, light-theme elevation + subtle colored glows
        glass: '0 8px 30px -8px rgba(79,70,229,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
        glow: '0 16px 40px -14px rgba(79,70,229,0.40)',
        'glow-cyan': '0 16px 40px -14px rgba(20,184,166,0.40)',
        'glow-rose': '0 16px 40px -14px rgba(251,113,133,0.45)',
        gold: '0 16px 40px -14px rgba(245,158,11,0.45)',
        card: '0 24px 60px -32px rgba(15,23,42,0.28)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
        'gradient-action': 'linear-gradient(135deg, #FB7185 0%, #F43F5E 55%, #E11D48 100%)',
        'gradient-prize': 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #B45309 100%)',
        'gradient-cyber': 'linear-gradient(135deg, #4F46E5 0%, #6366F1 45%, #14B8A6 100%)',
        'gradient-stage': 'radial-gradient(ellipse 80% 55% at 50% -8%, rgba(99,102,241,0.18) 0%, rgba(244,247,255,0) 62%)',
        'gradient-card': 'linear-gradient(160deg, #FFFFFF 0%, #F4F7FF 100%)',
        'gradient-page': 'linear-gradient(180deg, #F8FAFF 0%, #EEF2FE 100%)',
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
        'glow-pulse': { '0%,100%': { boxShadow: '0 0 30px -14px rgba(79,70,229,0.5)' }, '50%': { boxShadow: '0 0 50px -10px rgba(79,70,229,0.7)' } },
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
