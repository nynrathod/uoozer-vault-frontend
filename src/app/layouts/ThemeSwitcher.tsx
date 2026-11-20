import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@hooks/useTheme'
import { cn } from '@lib/utils'

/**
 * Ghost icon toggle in the 48px top bar (Foundations: "Top bar — 48 high,
 * ghost icons on the right"). Full appearance control stays in
 * Settings → Appearance.
 */
export function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={cn(
        'text-ghost hover:bg-hover-surface hover:text-ink focus-visible:outline-ring',
        'flex h-8 w-8 items-center justify-center rounded-lg outline outline-offset-2 outline-2 outline-transparent transition-colors duration-150'
      )}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-[17px] w-[17px]" strokeWidth={1.6} />
      ) : (
        <Moon className="h-[17px] w-[17px]" strokeWidth={1.6} />
      )}
    </button>
  )
}
