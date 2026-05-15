/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#0A0A0F', secondary: '#111118', card: '#16161E', border: '#1E1E2A' },
        gold: { DEFAULT: '#F4C542', dim: '#C9A227', light: '#FFD966' },
        green: { trade: '#00D4A1', dim: '#00A87D' },
        red: { trade: '#FF4757', dim: '#CC3344' },
        blue: { ai: '#6C8EFF', dim: '#4A6FE3' },
        text: { primary: '#FFFFFF', secondary: '#8888AA', muted: '#555570' }
      },
      fontFamily: { mono: ['JetBrains Mono', 'monospace'], sans: ['Inter', 'sans-serif'] }
    }
  },
  plugins: []
}
