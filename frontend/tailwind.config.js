/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fpt: {
          orange: "#F37021",
          green: "#51B848",
          blue: "#034EA2",
          white: "#FFFFFF",
        },
        // Primary palette (mapped to FPT Orange)
        primary: {
          DEFAULT: '#F37021',
          light: '#f58f4d',
          lighter: '#f8b48d',
          dark: '#c1581a',
          50: '#fff3ea',
          100: '#fdede4',
          200: '#fbd4c0',
          300: '#f9bb9d',
          400: '#f58f4d',
          500: '#f47d33',
          600: '#F37021',
          700: '#c1581a',
          800: '#914213',
          900: '#602c0d',
        },
        // Secondary (mapped to FPT Blue)
        secondary: {
          DEFAULT: '#034EA2',
          light: '#3371b8',
          dark: '#023a78',
          50: '#eaf2ff',
          100: '#d5e4fc',
          200: '#adc9f7',
          300: '#85aef2',
          400: '#5c93ed',
          500: '#3371b8',
          600: '#034EA2',
          700: '#023a78',
        },
        // Cyan accent (mapped to lighter FPT Blue for variety)
        cyan: {
          DEFAULT: '#0084c8',
          light: '#33a5dd',
          dark: '#006296',
          50: '#e6f6ff',
          100: '#cceeff',
          200: '#99ddff',
          300: '#66ccff',
          400: '#33bbff',
          500: '#00aaff',
          600: '#0084c8',
        },
        // Semantic colors
        success: {
          DEFAULT: '#51B848',
          light: '#7dd376',
          dark: '#3e8f37',
          50: '#ecfdf3',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fef3c7',
          dark: '#d97706',
          50: '#fffbeb',
        },
        danger: {
          DEFAULT: '#ef4444',
          light: '#fee2e2',
          dark: '#dc2626',
          50: '#fef2f2',
        },
        // Neutral surfaces
        slate: {
          25: '#fcfcfd',
          50: '#f8fafc',
          100: '#f1f5f9',
          150: '#edf1f7',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.025em', fontWeight: '700' }],
        'heading': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '600' }],
        'subheading': ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'overline': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card': '0 2px 8px -2px rgb(0 0 0 / 0.05), 0 1px 4px -2px rgb(0 0 0 / 0.04)',
        'elevated': '0 4px 16px -4px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
        'float': '0 8px 30px -6px rgb(0 0 0 / 0.1), 0 4px 10px -4px rgb(0 0 0 / 0.04)',
        'glow-primary': '0 0 20px -5px rgba(243, 112, 33, 0.25)',
        'glow-cyan': '0 0 20px -5px rgba(3, 78, 162, 0.25)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 3s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
