import { Sun, Moon } from 'lucide-react'
import { Button } from '@ui/Button'
import { useTheme } from '@hooks/useTheme'

export function ThemeSwitcher() {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:bg-secondary hover:text-foreground h-9 w-9 rounded-lg"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-[18px] w-[18px]" />
      ) : (
        <Moon className="h-[18px] w-[18px]" />
      )}
    </Button>
  )
}
