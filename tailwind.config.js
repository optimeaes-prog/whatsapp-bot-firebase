/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          // Brand orange (logo): #FFB03F
          50: "#FFF7E6",
          100: "#FFEBC2",
          200: "#FFD58A",
          300: "#FFC04D",
          400: "#FFB84A",
          500: "#FFB03F",
          600: "#E8992C",
          700: "#C97F1E",
          800: "#A96616",
          900: "#7A4A10",
          950: "#4A2C08",
        },
        // WhatsApp-style user bubble green (used on landing demo)
        whatsapp: {
          bubble: "#DCF8C6",
        },
      },
    },
  },
  plugins: [],
}
