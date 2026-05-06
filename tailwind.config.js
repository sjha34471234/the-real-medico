/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1A3A8F',
        'primary-dark': '#142d70',
        'primary-light': '#2563EB',
        accent: '#E8F0FE',
        'text-dark': '#1E293B',
        'text-slate': '#64748B',
        error: '#EF4444',
        success: '#22C55E',
      },
      fontFamily: {
        heading: ['Merriweather', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
