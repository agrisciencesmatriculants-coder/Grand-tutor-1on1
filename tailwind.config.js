/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Golden-ratio light theme (contract §16) — bright, warm, hopeful.
        ivory: {
          DEFAULT: '#faf6ee', // base background
          deep: '#f5efe1', // recessed panels / wells
        },
        paper: '#ffffff', // cards
        sand: {
          DEFAULT: '#e8ddc4', // warm borders
          deep: '#d8caa6', // stronger borders / dividers
        },
        gold: {
          DEFAULT: '#c9992e', // primary accent (icons, highlights)
          deep: '#a07c1f', // hover state + accent text on light backgrounds
          tint: '#f4e8c8', // soft gold background tint
        },
        sage: {
          DEFAULT: '#7d8c5c', // secondary / success
          deep: '#5f6e45', // sage text on light backgrounds
          tint: '#e6ead9',
        },
        terra: {
          DEFAULT: '#b4664a', // warnings / LIVE
          deep: '#96503a', // terracotta text on light backgrounds
          tint: '#f3e0d8',
        },
        ink: {
          DEFAULT: '#3a2f1d', // headings / strong text
          soft: '#6b5d43', // body text
        },
      },
      spacing: {
        // Golden-ratio rhythm (13 / 21 / 34 / 55 px) — contract §16.
        'gr-1': '0.8125rem',
        'gr-2': '1.3125rem',
        'gr-3': '2.125rem',
        'gr-4': '3.4375rem',
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
