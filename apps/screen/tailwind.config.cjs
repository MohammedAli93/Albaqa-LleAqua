/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@tahaddi/config/tailwind-preset.cjs')],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
