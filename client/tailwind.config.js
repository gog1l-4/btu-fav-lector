/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"BPGNinoMedium"', '"Noto Sans Georgian"', 'system-ui', 'sans-serif'],
        title: ['"DachiTheLynx"', '"BPGNinoMedium"', '"Noto Sans Georgian"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)',
        soft: '0 10px 30px -10px rgba(79, 70, 229, 0.12)',
      },
    },
  },
  plugins: [],
};
