// Tailwind 4 is a PostCSS plugin and needs no tailwind.config.js — theme and content detection are
// handled from the CSS side (see src/app/globals.css).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
