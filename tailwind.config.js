/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Institutional light theme (DBE / SA government register):
        // white base, black text, neutral greys, one official accent
        // (South African green). The class names are kept so every
        // existing component re-skins automatically.
        ivory: {
          DEFAULT: '#ffffff', // base background
          deep: '#f5f5f4', // recessed panels / wells
        },
        paper: '#ffffff', // cards
        sand: {
          DEFAULT: '#d4d4d4', // borders
          deep: '#a3a3a3', // stronger borders / dividers
        },
        gold: {
          DEFAULT: '#007749', // primary accent — SA green
          deep: '#005c39', // hover state + accent text
          tint: '#e6f2ec', // soft accent background tint
        },
        sage: {
          DEFAULT: '#2e7d32', // success
          deep: '#1b5e20',
          tint: '#e8f5e9',
        },
        terra: {
          DEFAULT: '#b91c1c', // warnings / destructive
          deep: '#991b1b',
          tint: '#fee2e2',
        },
        ink: {
          DEFAULT: '#111111', // headings / strong text
          soft: '#444444', // body text
        },
      },
      spacing: {
        'gr-1': '0.8125rem',
        'gr-2': '1.3125rem',
        'gr-3': '2.125rem',
        'gr-4': '3.4375rem',
      },
      fontFamily: {
        // Formal government register: one sans family everywhere.
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
