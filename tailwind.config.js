/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stage: {
          bg: '#17111c',
          panel: '#1f1626',
          deep: '#120d17',
        },
        gold: {
          DEFAULT: '#e8b34b',
          light: '#f5d08a',
          dim: '#b3873a',
        },
        crimson: {
          DEFAULT: '#a63d40',
          light: '#c8565a',
        },
        cream: {
          DEFAULT: '#f7f0e3',
          dim: '#cbbfa9',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
