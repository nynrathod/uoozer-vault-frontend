import { Menu, X, Search } from 'lucide-react'
import { useUIStore } from '@stores/uiStore'
import { cn } from '@lib/utils'

import { ProfileDropdown } from './ProfileDropdown'
import { ThemeSwitcher } from './ThemeSwitcher'
import { SearchCommand } from '@/components/ui/overlays'

/** Top app bar with mobile sidebar toggle, search, theme and profile. */
export function Header() {
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)

  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen)

  return (
    <header className="border-border/60 bg-background/80 z-30 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-3 backdrop-blur-xl lg:px-5">
      {/* Left side: Mobile menu + Search */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={mobileMenuOpen}
          aria-controls="app-sidebar"
          className={cn(
            'text-muted-foreground hover:bg-secondary hover:text-foreground',
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
            'lg:hidden'
          )}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Search */}
        <div className="relative w-full max-w-[440px]">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'bg-secondary/70 flex h-10 w-full items-center gap-2.5 rounded-lg border border-transparent px-3.5 text-sm transition-all duration-150',
              'hover:bg-secondary focus-visible:border-primary/40 focus-visible:outline-none'
            )}
          >
            <Search className="text-muted-foreground/60 h-4 w-4 shrink-0" />

            <span className="text-muted-foreground/70 flex-1 truncate text-left">
              Search files...
            </span>

            <kbd className="border-border/70 bg-background text-muted-foreground/50 hidden h-[22px] items-center rounded border px-1.5 text-[11px] font-medium shadow-sm sm:inline-flex">
              ⌘K
            </kbd>
          </button>

          <SearchCommand />
        </div>
      </div>

      {/* Right side: Theme + Profile */}
      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        <ThemeSwitcher />
        <ProfileDropdown />
      </div>
    </header>
  )
}
