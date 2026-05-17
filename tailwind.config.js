/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        accent: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.08), inset 0 1px 0 0 rgba(255,255,255,0.6)',
        'glass-lg': '0 16px 48px -4px rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255,255,255,0.7)',
        'glass-xl': '0 24px 64px -8px rgba(31, 38, 135, 0.18), inset 0 1px 0 0 rgba(255,255,255,0.8)',
        'glow-accent': '0 0 24px -4px rgba(99, 102, 241, 0.45)',
        'glow-accent-lg': '0 0 40px -8px rgba(99, 102, 241, 0.55)',
        'soft': '0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 4px 16px -4px rgba(15, 23, 42, 0.04)',
        'soft-lg': '0 4px 16px -4px rgba(15, 23, 42, 0.06), 0 8px 32px -8px rgba(15, 23, 42, 0.06)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 16px -4px rgba(99, 102, 241, 0.4)' },
          '50%': { boxShadow: '0 0 32px -2px rgba(99, 102, 241, 0.7)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-down': 'fade-in-down 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
