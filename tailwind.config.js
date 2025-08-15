/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/*.{html,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Usando fontes do sistema para um look mais nativo, como sugerido pela Apple
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Nova paleta "Foco Clínico"
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        'dark-bg': 'var(--dark-bg)',
        'dark-card': 'var(--dark-card)',
        'glass-border': 'var(--glass-border)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem', // Bordas mais suaves
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': 'var(--shadow-soft)',
        'medium': 'var(--shadow-medium)',
        'primary': 'var(--shadow-primary)',
      },
      animation: {
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)', // Animação mais fluida
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        },
        spin: {
          'to': { transform: 'rotate(360deg)' }
        }
      },
    },
  },
  plugins: [],
}