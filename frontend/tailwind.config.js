/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#F59E0B',
        gray: {
          900: '#111827',
          600: '#4B5563',
          300: '#D1D5DB',
          50: '#F9FAFB'
        },
        secondary: '#64748B',
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E5E7EB'
      },
      fontFamily: {
        sans: ["Cairo", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        heading: ["Cairo", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
}
