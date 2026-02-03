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
          50: '#FFF9EB',
          100: '#FEF0C7',
          200: '#FEE08A',
          300: '#FCCC4D',
          400: '#F8B82D',
          500: '#F5A623',
          600: '#D98A06',
          700: '#B66E07',
          800: '#935609',
          900: '#78460D',
          950: '#45260A',
        },
      },
    },
  },
  plugins: [],
}
