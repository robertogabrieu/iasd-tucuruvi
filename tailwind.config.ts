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
        // Cores da ASA (Ação Solidária Adventista), medidas no logo oficial em vetor.
        asa: {
          gold: '#B48C1D',
          'gold-deep': '#8A6A12', // dourado com contraste suficiente para texto em fundo claro
          ink: '#11261D',
          cream: '#FAF7EF',
          sand: '#F0EADC',
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
