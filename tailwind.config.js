/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./public/script.js" 
  ],
  theme: {
    extend: {
      // Adicionado para registrar as cores customizadas
      colors: {
        'incor-blue': '#005a9c',
        'incor-red': '#d41a2d',
        'incor-light-blue': '#4a90e2',
        'incor-dark-blue': '#003e6e',
        'success': '#28a745',
      },
      fontFamily: {
        'display': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'text': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
