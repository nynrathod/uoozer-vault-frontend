import { NavLink } from 'react-router-dom'
import { FolderOpen, Search, Settings, StickyNote } from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useUIStore } from '@stores/uiStore'

/**
 * Fixed bottom navigation bar for mobile viewports.
 * Every entry is a working action — Vault, Notes and Settings navigate,
 * Search opens the real ⌘K search overlay. No dummy links.
 */
export function MobileNav() {
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)

  const items = [
    { label: 'Vault', icon: FolderOpen, to: ROUTES.VAULT, active: (p: string) => p.startsWith('/vault') },
    { label: 'Notes', icon: StickyNote, to: ROUTES.NOTES, active: (p: string) => p.startsWith('/notes') },
  ]

  return (
    <nav className="bg-background/95 border-line fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl">
      <div className="flex h-16 items-center justify-around">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.6} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="text-muted-foreground flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors"
          aria-label="Search (⌘K)"
        >
          <Search className="h-5 w-5" strokeWidth={1.6} />
          <span>Search</span>
        </button>

        <NavLink
          to={ROUTES.SETTINGS}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          <Settings className="h-5 w-5" strokeWidth={1.6} />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  )
}
