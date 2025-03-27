/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'solrent-orange': '#ff5722',
        'solrent-dark': '#212121',
        'solrent-gray': '#808080'
      }
    },
  },
  plugins: [],
};