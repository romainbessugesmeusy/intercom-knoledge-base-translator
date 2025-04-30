/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        'modal': 50,
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  },
} 