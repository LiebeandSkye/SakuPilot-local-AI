/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0, 0, 0, 0.32)',
      },
      /* ----------------------------------------------------------
       * Semantic color tokens — backed by RGB-channel CSS variables
       * so Tailwind opacity modifiers (bg-bg/80) work, and the
       * values flip automatically between light and dark themes.
       * ---------------------------------------------------------- */
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-subtle': 'rgb(var(--c-surface-subtle) / <alpha-value>)',
        'surface-hover': 'rgb(var(--c-surface-hover) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--c-surface-sunken) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',
        'border-soft': 'rgb(var(--c-border-soft) / <alpha-value>)',
        text: 'rgb(var(--c-text) / <alpha-value>)',
        'text-secondary': 'rgb(var(--c-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--c-text-tertiary) / <alpha-value>)',
        'text-faint': 'rgb(var(--c-text-faint) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        'success-soft': 'rgb(var(--c-success-soft) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--c-warning-soft) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--c-danger-soft) / <alpha-value>)',
        'user-bubble': 'rgb(var(--c-user-bubble) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
