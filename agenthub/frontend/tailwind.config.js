/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        agent: {
          coordinator: '#3B82F6',
          researcher: '#8B5CF6',
          writer: '#10B981',
          editor: '#14B8A6',
          coder: '#F97316',
          reviewer: '#EF4444',
          analyst: '#6366F1',
          sysadmin: '#6B7280',
          creative: '#EC4899',
          planner: '#EAB308',
          assistant: '#06B6D4',
        },
      },
    },
  },
  plugins: [],
};
