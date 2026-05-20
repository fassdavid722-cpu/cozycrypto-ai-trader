import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary backgrounds
        'bg-primary': '#0A0E27',
        'bg-secondary': '#16161E',
        'bg-tertiary': '#1E1E2A',
        'bg-border': '#2A2A3E',
        'bg-hover': '#252533',

        // Text colors
        'text-primary': '#FFFFFF',
        'text-secondary': '#B0B0C0',
        'text-muted': '#707080',
        'text-disabled': '#505060',

        // Accent colors
        'gold': '#FFD700',
        'gold-dim': '#E6C200',
        'gold-light': '#FFF8DC',

        'blue-ai': '#00A8FF',
        'blue-ai-dim': '#0088CC',

        'green-trade': '#00D4A1',
        'green-trade-dim': '#00A080',

        'red-trade': '#FF4757',
        'red-trade-dim': '#CC3A47',

        'purple-ai': '#9D4EDD',
        'orange-alert': '#FF9500',

        // Semantic colors
        'success': '#00D4A1',
        'warning': '#FFD700',
        'danger': '#FF4757',
        'info': '#00A8FF',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Courier New', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['11px', '14px'],
        'sm': ['12px', '16px'],
        'base': ['13px', '18px'],
        'lg': ['14px', '20px'],
        'xl': ['16px', '24px'],
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 168, 255, 0.3)',
        'glow-green': '0 0 20px rgba(0, 212, 161, 0.3)',
        'glow-red': '0 0 20px rgba(255, 71, 87, 0.3)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        'xs': '2px',
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      spacing: {
        'gutter': '16px',
        'gap': '8px',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'thinking': 'thinking 1.4s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'thinking': {
          '0%, 60%, 100%': { opacity: '0.5' },
          '30%': { opacity: '1' },
        },
        'slide-in': {
          'from': { transform: 'translateX(-10px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
