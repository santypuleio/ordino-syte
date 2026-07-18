/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit"', "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#07090c",
          900: "#0c1016",
          800: "#151b24",
          700: "#1e2733",
        },
        signal: {
          DEFAULT: "#3dd68c",
          soft: "#9af0c0",
          deep: "#1f9a5c",
        },
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        rise: "rise 0.7s ease-out both",
        "rise-delay": "rise 0.7s ease-out 0.12s both",
        "rise-delay-2": "rise 0.7s ease-out 0.24s both",
        glow: "glow 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
