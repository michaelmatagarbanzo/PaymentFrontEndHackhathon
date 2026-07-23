/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        // "navy" tokens repurposed as light surface layers
        navy: {
          950: '#FFFFFF',
          900: '#F8FAFC',
          800: '#F1F5F9',
          700: '#E2E8F0',
          600: '#CBD5E1',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
          raised: '#F1F5F9',
        },
        cyan: {
          400: '#0891B2',
          500: '#0E7490',
          600: '#155E75',
        },
        emerald: {
          400: '#059669',
          500: '#047857',
        },
        amber: {
          400: '#D97706',
          500: '#B45309',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(8, 145, 178, 0.12)',
        'glow-cyan-md': '0 0 40px rgba(8, 145, 178, 0.18)',
        'glow-emerald': '0 0 20px rgba(5, 150, 105, 0.12)',
        'inset-subtle': 'inset 0 1px 0 rgba(0,0,0,0.04)',
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
