/**
 * Shared Tailwind preset — the design tokens from docs/architecture/11-design-system.md.
 * Consumed by apps/screen, apps/controller, apps/admin.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0A14',
          raised: '#12121F',
          sunken: '#06060D',
        },
        brand: {
          violet: '#7C3AED',
          indigo: '#4F46E5',
          magenta: '#C026D3',
          cyan: '#22D3EE',
        },
        prize: {
          gold: '#F5C518',
          deep: '#B8860B',
        },
        ink: {
          primary: '#F5F5FA',
          secondary: '#A9A9C2',
          muted: '#6E6E8A',
        },
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#38BDF8',
      },
      fontFamily: {
        display: ['Tajawal', 'Russo One', 'system-ui', 'sans-serif'],
        body: ['"IBM Plex Sans Arabic"', '"Chakra Petch"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.37), inset 0 1px 0 rgba(255,255,255,0.06)',
        glow: '0 0 40px rgba(124,58,237,0.45)',
        gold: '0 0 48px rgba(245,197,24,0.5)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)',
        'gradient-prize': 'linear-gradient(135deg, #F5C518 0%, #B8860B 100%)',
        'gradient-stage': 'radial-gradient(ellipse at 50% 0%, rgba(79,70,229,0.35) 0%, rgba(10,10,20,0) 60%)',
      },
      keyframes: {
        'gradient-pan': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'gradient-pan': 'gradient-pan 8s ease infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
