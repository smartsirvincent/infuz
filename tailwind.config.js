/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        // Infuz palette · ui-ux-pro-max search 建議 (Premium black + gold, fashion/jewelry)
        ink: '#1C1917',
        bone: '#FAFAF9',
        linen: '#F5F5F4',
        muted: '#475569',
        'muted-bg': '#E8ECF0',
        divider: '#D6D3D1',
        // Gold accent (取代 orange brand) · 珠寶線靈感
        gold: {
          DEFAULT: '#A16207',
          hover: '#854D0E',
          soft: '#FEF3C7',
        },
        // Rose 保留 · 女裝線 secondary accent
        rose: {
          DEFAULT: '#B04F3A',
          hover: '#9C4432',
          soft: '#F2E4DF',
        },
      },
      fontFamily: {
        // Fashion/jewelry pairing (Cormorant + Montserrat) · ui-ux-pro-max 建議
        sans: ['Montserrat', '"Noto Sans TC"', 'system-ui', '-apple-system', '"PingFang TC"', 'sans-serif'],
        display: ['Cormorant', '"Noto Serif TC"', 'Georgia', '"Songti TC"', 'serif'],
        serif: ['Cormorant', '"Noto Serif TC"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
};
