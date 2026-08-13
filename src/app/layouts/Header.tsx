import { useLocation } from 'react-router-dom'
import { Search, Bell, Upload, Plus } from 'lucide-react'
import { Button } from '@ui/Button'
import { useUIStore } from '@stores/uiStore'
import { cn } from '@lib/utils'

import { ProfileDropdown } from './ProfileDropdown'
import { ThemeSwitcher } from './ThemeSwitcher'
import { SearchCommand } from '@/components/ui/overlays'

export function Header() {
  const location = useLocation()
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const isVault = location.pathname.startsWith('/vault')

  return (
    <header className="border-border/60 bg-background/80 z-50 flex h-[60px] shrink-0 items-center justify-between border-b px-4 backdrop-blur-xl lg:px-5">
      <div className="flex min-w-0 flex-1 items-center">
        <div className="relative w-full max-w-[440px]">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'bg-secondary/70 flex h-10 w-full max-w-[440px] items-center gap-2.5 rounded-lg border border-transparent px-3.5 text-sm transition-all duration-150',
              'hover:bg-secondary focus-visible:border-primary/40 focus-visible:outline-none'
            )}
          >
            <Search className="text-muted-foreground/60 h-4 w-4 shrink-0" />
            <span className="text-muted-foreground/70 flex-1 text-left">Search files...</span>
            <kbd className="border-border/70 bg-background text-muted-foreground/50 hidden h-[22px] items-center rounded border px-1.5 text-[11px] font-medium shadow-sm sm:inline-flex">
              ⌘K
            </kbd>
          </button>
          <SearchCommand />
        </div>
      </div>

      <div className="ml-4 flex items-center gap-1.5">
        {isVault && (
          <>
            <Button
              variant="default"
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 hidden h-[34px] gap-1.5 rounded-lg px-3.5 text-[13px] font-medium shadow-none sm:flex"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> New
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-secondary hidden h-[34px] gap-1.5 rounded-lg px-3 text-[13px] font-medium shadow-none sm:flex"
              onClick={() => setUploadPanelOpen(true)}
            >
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </>
        )}

        <div className="bg-border/70 mx-1 h-5 w-px" />

        <ThemeSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground relative h-9 w-9 rounded-lg"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="bg-primary ring-background absolute top-2 right-2 h-2 w-2 rounded-full ring-2" />
        </Button>

        <ProfileDropdown />
      </div>
    </header>
  )
}
