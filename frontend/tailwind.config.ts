import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#e94560',
          dark: '#c53350',
          light: '#ff6d8b',
        },
        bg: {
          DEFAULT: '#0f0f1a',
          elevated: '#16162a',
          panel: '#1a1a2e',
          input: '#121222',
          hover: '#1f1f38',
        },
        line: '#2a2a44',
        ink: {
          DEFAULT: '#f5f5f7',
          muted: '#9ca3af',
          dim: '#6b7280',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'typing-bounce': {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'pop-in': 'pop-in 160ms ease-out',
        'typing-bounce': 'typing-bounce 1.2s infinite',
      },
    },
  },
  plugins: [],
}

export default config
