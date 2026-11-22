/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#14213D',
          'deep-navy': '#0B1730',
          honey: '#F5B700',
          'soft-honey': '#FFF4CC',
          bg: '#F8FAFC',
          text: '#172033',
          muted: '#64748B',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 6px -1px rgba(20, 33, 61, 0.05), 0 2px 4px -1px rgba(20, 33, 61, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(20, 33, 61, 0.1), 0 4px 6px -2px rgba(20, 33, 61, 0.05)',
      },
    },
  },
  plugins: [],
}

