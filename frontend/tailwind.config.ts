import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        udemm: {
          blue: '#003D7A',
          light: '#E9F1FF',
          orange: '#FF7A18'
        }
      }
    }
  },
  plugins: []
};

export default config;
