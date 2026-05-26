/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cockpit: {
          void: '#0A0C10',
          bar: '#0F1218',
          slab: '#13171F',
          raised: '#1A1F29',
          edge: '#232A36',
          inlay: '#0B0E14',
          'text-primary': 'rgba(255,255,255,0.92)',
          'text-secondary': 'rgba(255,255,255,0.62)',
          'text-muted': 'rgba(255,255,255,0.40)',
          'text-ghost': 'rgba(255,255,255,0.20)',
          safe: '#34D399',
          watch: '#FBBF24',
          danger: '#F87171',
          info: '#60A5FA',
        },
      },
      boxShadow: {
        'cockpit-slab':
          '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -16px rgba(0,0,0,0.6)',
        'cockpit-accent':
          '0 0 0 1px var(--team-primary, #4F46E5), 0 0 12px -8px var(--team-primary, #4F46E5)',
      },
    },
  },
  plugins: [],
}
