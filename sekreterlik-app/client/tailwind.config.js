/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode with class strategy
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50, #eef2ff)',
          100: 'var(--color-primary-100, #e0e7ff)',
          200: 'var(--color-primary-200, #c7d2fe)',
          300: 'var(--color-primary-300, #a5b4fc)',
          400: 'var(--color-primary-400, #818cf8)',
          500: 'var(--color-primary-500, #6366f1)',
          600: 'var(--color-primary-600, #4f46e5)',
          700: 'var(--color-primary-700, #4338ca)',
          800: 'var(--color-primary-800, #3730a3)',
          900: 'var(--color-primary-900, #312e81)',
          950: 'var(--color-primary-950, #1e1b4e)',
        },
      },
      zIndex: {
        'base': '10',
        'dropdown': '20',
        'sticky': '30',
        'overlay': '40',
        'modal': '50',
        'toast': '60',
        'top': '70',
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}