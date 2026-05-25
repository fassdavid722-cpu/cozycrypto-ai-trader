/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.08)",
        ring: "#22c55e",
        background: "#0e0e0e",
        foreground: "#fafafa",
        primary: {
          DEFAULT: "#22c55e",
          foreground: "#fafafa",
        },
        secondary: {
          DEFAULT: "#171717",
          foreground: "#fafafa",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#171717",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#171717",
          foreground: "#fafafa",
        },
        popover: {
          DEFAULT: "#171717",
          foreground: "#fafafa",
        },
        card: {
          DEFAULT: "#171717",
          foreground: "#fafafa",
        },
        sidebar: {
          DEFAULT: "#111111",
          foreground: "#a1a1aa",
          primary: "#22c55e",
          "primary-foreground": "#ffffff",
          accent: "#171717",
          "accent-foreground": "#fafafa",
          border: "rgba(255, 255, 255, 0.08)",
          ring: "#22c55e",
        },
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
        xs: "2px",
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
