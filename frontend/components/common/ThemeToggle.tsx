'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="
        inline-flex items-center gap-2
        px-3 h-[34px]
        rounded-[var(--radius)]
        border-[1.5px] border-[hsl(var(--green))]
        bg-transparent
        text-[hsl(var(--green))]
        text-sm font-medium
        transition-all duration-[180ms] ease-in-out
        hover:bg-[hsl(var(--green))]
        hover:text-[hsl(var(--primary-foreground))]
        hover:scale-[1.05]
        hover:shadow-[0_0_16px_hsl(var(--green-glow))]
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[hsl(var(--ring))]
      "
    >
      {theme === 'dark' ? (
        <Sun size={15} aria-hidden="true" />
      ) : (
        <Moon size={15} aria-hidden="true" />
      )}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
