import { NavLink } from 'react-router-dom'
import { FolderOpen, StickyNote, Settings, Plus } from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'

const navItems = [
  { label: 'Vault', icon: FolderOpen, path: ROUTES.VAULT },
  { label: 'Notes', icon: StickyNote, path: ROUTES.NOTES },
  { label: 'Add', icon: Plus, path: '#', action: true },
  { label: 'Settings', icon: Settings, path: ROUTES.SETTINGS },
]

/** Fixed bottom navigation bar for mobile viewports. */
export function MobileNav() {
  return (
    <nav className="border-border/60 bg-background/90 pb-safe fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          if (item.action) {
            return (
              <button
                key={item.label}
                className="bg-foreground text-background flex h-12 w-12 -translate-y-1.5 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
              >
                <item.icon className="h-5 w-5" strokeWidth={2.5} />
              </button>
            )
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground/70'
                )
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
