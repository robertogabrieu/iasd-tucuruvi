import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        iasd: {
          dark: '#003366',
          accent: '#0055AA',
          light: '#F5F5F5',
        },
        antares: {
          red: '#ad220f',
          gold: '#faca13',
          ink: '#1f1d1b',
          cream: '#faf5ee',
          sand: '#f3ebd9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Montserrat', 'sans-serif'],
      },
      keyframes: {
        downSlice: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        revealWidth: {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      animation: {
        'down-slice': 'downSlice 0.8s ease-out forwards',
        'reveal-width': 'revealWidth 0.8s ease-out 0.3s forwards',
      },
    },
  },
  plugins: [],
}

export default config
