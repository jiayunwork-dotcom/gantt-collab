/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        critical: '#EF4444',
        urgent: '#DC2626',
        high: '#F59E0B',
        medium: '#3B82F6',
        low: '#6B7280',
      },
    },
  },
  plugins: [],
};
