import React, { useState, useEffect } from 'react';
import { IconSun, IconMoon } from '@tabler/icons-react';

const ThemeToggle = () => {
  // Check for stored theme preference or use system preference
  const initialTheme = () => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      return storedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(initialTheme);

  // Update the HTML root class when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle between dark and light theme
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-surface-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <IconMoon size={20} />
      ) : (
        <IconSun size={20} />
      )}
    </button>
  );
};

export default ThemeToggle; 