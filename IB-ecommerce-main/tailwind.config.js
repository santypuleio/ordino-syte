/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ordino: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
          muted: "#6ee7b7",
        },
      },
    },
  },
  plugins: [],
};