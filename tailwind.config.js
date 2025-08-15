/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        primary: 'var(--primary)',
        'primary-dark': 'var(--primary-dark)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        'dark-bg': 'var(--dark-bg)',
        'dark-card': 'var(--dark-card)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'slide-up': 'slideUp 0.7s ease-out',
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