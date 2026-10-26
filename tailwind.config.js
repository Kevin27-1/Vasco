/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        card: '#1a1a1a',
        'card-hover': '#242424',
        accent: '#e63946', // Warm red/orange for tyre branding
        'accent-hover': '#f7404e',
        text: {
          main: '#f3f4f6',
          muted: '#9ca3af'
        },
        border: '#2e2e2e'
      }
    },
  },
  plugins: [],
}
