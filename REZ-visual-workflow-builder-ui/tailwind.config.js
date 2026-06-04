/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Node type colors
        trigger: { DEFAULT: '#3B82F6', light: '#60A5FA' },
        action: { DEFAULT: '#10B981', light: '#34D399' },
        logic: { DEFAULT: '#F59E0B', light: '#FBBF24' },
        flow: { DEFAULT: '#8B5CF6', light: '#A78BFA' },
        // Canvas
        canvas: { DEFAULT: '#0F172A', grid: '#1E293B' },
        // Borders
        border: { DEFAULT: '#334155' }
      }
    }
  },
  plugins: []
}
