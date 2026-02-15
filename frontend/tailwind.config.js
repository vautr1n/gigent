/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1B1612',
          soft: '#3D3530',
          muted: '#7A6F66',
        },
        sand: {
          DEFAULT: '#F7F4F0',
          deep: '#EDE8E1',
        },
        cream: '#FDFCFA',
        ember: {
          DEFAULT: '#C8552D',
          light: '#FCEEE9',
          glow: '#E8774F',
        },
        sage: {
          DEFAULT: '#2D7A5F',
          light: '#D4EDE3',
          glow: '#3DA87A',
        },
        signal: {
          DEFAULT: '#D4A024',
          light: '#FDF5E1',
        },
        info: {
          DEFAULT: '#3B7DD8',
          light: '#E8F0FC',
        },
        border: {
          DEFAULT: '#E6E0D8',
          subtle: '#F0EBE4',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'warm-sm': '0 1px 3px rgba(27, 22, 18, 0.06)',
        'warm-md': '0 4px 12px rgba(27, 22, 18, 0.08)',
        'warm-lg': '0 8px 24px rgba(27, 22, 18, 0.10)',
      },
      borderRadius: {
        'brand': '0.75rem',
      },
    },
  },
  plugins: [],
};
