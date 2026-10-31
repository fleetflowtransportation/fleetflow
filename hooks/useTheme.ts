import { useEffect } from 'react';

export type ThemeMode = 'light';

export function useTheme() {
  useEffect(() => {
    try {
      localStorage.removeItem('armada-theme');
      document.documentElement.classList.remove('dark');
    } catch {}
  }, []);

  return { 
    theme: 'light' as const, 
    setTheme: () => {}, 
    toggleTheme: () => {}, 
    isDark: false 
  };
}