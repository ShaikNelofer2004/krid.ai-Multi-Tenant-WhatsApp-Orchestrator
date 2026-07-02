/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#fffbf0', 100: '#fef3c7', 200: '#fde68a',
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 800: '#92400e',
          900: '#78350f', 950: '#451a03',
        },
        slate: {
          25: '#fafbfc', 50: '#f8fafc', 100: '#f1f5f9', 150: '#eaeff5',
          200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
          600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        success: { light: '#f0fdf4', mid: '#dcfce7', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
        warning: { light: '#fffbeb', mid: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
        danger:  { light: '#fff1f2', mid: '#ffe4e6', text: '#9f1239', border: '#fecdd3', dot: '#ef4444' },
        info:    { light: '#f0f9ff', mid: '#e0f2fe', text: '#0c4a6e', border: '#bae6fd', dot: '#0ea5e9' },
      },
      boxShadow: {
        'card':     '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        'card-md':  '0 4px 6px -1px rgba(15,23,42,0.07), 0 2px 4px -1px rgba(15,23,42,0.04)',
        'card-lg':  '0 10px 15px -3px rgba(15,23,42,0.08), 0 4px 6px -2px rgba(15,23,42,0.04)',
        'card-xl':  '0 20px 40px -8px rgba(15,23,42,0.12), 0 8px 16px -4px rgba(15,23,42,0.06)',
        'glow-sm':  '0 0 12px rgba(245,158,11,0.25)',
        'glow-md':  '0 0 24px rgba(245,158,11,0.3)',
        'ring-brand':'0 0 0 3px rgba(245,158,11,0.15)',
      },
      animation: {
        /* entrances */
        'fade-in':     'fadeIn 0.4s ease-out both',
        'fade-up':     'fadeUp 0.5s ease-out both',
        'fade-up-sm':  'fadeUpSm 0.4s ease-out both',
        'slide-up':    'slideUp 0.35s ease-out both',
        'slide-in-r':  'slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in':    'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        /* continuous */
        'float':       'float 6s ease-in-out infinite',
        'float-slow':  'float 9s ease-in-out infinite',
        'gradient-x':  'gradientX 6s ease infinite',
        'shimmer':     'shimmer 1.8s linear infinite',
        'pulse-dot':   'pulseDot 2s ease-in-out infinite',
        'spin-slow':   'spin 8s linear infinite',
        'border-spin': 'borderSpin 3s linear infinite',
        'typing-cursor':'typingCursor 1s step-end infinite',
        /* stagger helpers — applied via style.animationDelay */
        'count-up':    'countUp 0.8s ease-out both',
        'orbit':       'orbit 12s linear infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0 },                              to: { opacity: 1 } },
        fadeUp:       { from: { opacity: 0, transform: 'translateY(24px)'},to: { opacity: 1, transform: 'none' } },
        fadeUpSm:     { from: { opacity: 0, transform: 'translateY(12px)'},to: { opacity: 1, transform: 'none' } },
        slideUp:      { from: { opacity: 0, transform: 'translateY(10px)'},to: { opacity: 1, transform: 'none' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(24px)'},to: { opacity: 1, transform: 'none' } },
        scaleIn:      { from: { opacity: 0, transform: 'scale(0.88)' },    to: { opacity: 1, transform: 'scale(1)' } },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-16px)' },
        },
        gradientX: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
        pulseDot: {
          '0%,100%': { opacity: 1,   transform: 'scale(1)' },
          '50%':     { opacity: 0.4, transform: 'scale(0.8)' },
        },
        typingCursor: {
          '0%,100%': { opacity: 1 },
          '50%':     { opacity: 0 },
        },
        countUp: {
          from: { opacity: 0, transform: 'translateY(12px) scale(0.9)' },
          to:   { opacity: 1, transform: 'none' },
        },
        borderSpin: {
          to: { '--angle': '360deg' },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          to:   { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34,1.56,0.64,1)',
        'smooth': 'cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}
