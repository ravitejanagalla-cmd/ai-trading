import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Use class strategy instead of media query
  theme: {
    extend: {
      colors: {
        slate: {
          '950': '#050c1a',
        },
      },
      boxShadow: {
        'elevated': '0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.12), 0 8px 12px rgba(0, 0, 0, 0.1)',
        'elevated-lg': '0 2px 4px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.14), 0 16px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
        'elevated-xl': '0 3px 6px rgba(0, 0, 0, 0.12), 0 12px 20px rgba(0, 0, 0, 0.16), 0 24px 32px rgba(0, 0, 0, 0.14), 0 8px 12px rgba(0, 0, 0, 0.1)',
        'elevated-2xl': '0 4px 8px rgba(0, 0, 0, 0.14), 0 16px 32px rgba(0, 0, 0, 0.18), 0 32px 48px rgba(0, 0, 0, 0.16), 0 12px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
