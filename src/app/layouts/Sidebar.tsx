import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  StickyNote,
  Settings,
  Shield,
  HardDrive,
  Activity,
  Star,
  Lock,
  Trash2,
  Pin,
  KeyRound,
  Check,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useUIStore } from '@stores/uiStore'
import { useAuthStore } from '@stores/authStore'
import { Button } from '@ui/Button'

const systemNav = [
  { label: 'Devices', icon: HardDrive, path: ROUTES.DEVICES },
  { label: 'Audit Logs', icon: Activity, path: ROUTES.AUDIT_LOGS },
  { label: 'Settings', icon: Settings, path: ROUTES.SETTINGS },
]

const apps = [
  {
    id: 'vault',
    name: 'Vault',
    icon: FolderOpen,
    basePath: ROUTES.VAULT,
    routes: [
      { label: 'All Files', icon: FolderOpen, path: ROUTES.VAULT },
      { label: 'Starred', icon: Star, path: ROUTES.VAULT_STARRED },
      { label: 'Private Files', icon: Lock, path: ROUTES.VAULT_PRIVATE },
      { label: 'Trash', icon: Trash2, path: ROUTES.VAULT_TRASH },
    ],
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: StickyNote,
    basePath: ROUTES.NOTES,
    routes: [
      { label: 'All Notes', icon: StickyNote, path: ROUTES.NOTES },
      { label: 'Pinned', icon: Pin, path: ROUTES.NOTES_PINNED },
      { label: 'Trash', icon: Trash2, path: ROUTES.NOTES_TRASH },
    ],
  },
  {
    id: 'passwords',
    name: 'Passwords',
    icon: KeyRound,
    basePath: ROUTES.PASSWORDS,
    routes: [
      { label: 'All Passwords', icon: KeyRound, path: ROUTES.PASSWORDS },
      { label: 'Favorites', icon: Star, path: ROUTES.PASSWORDS_FAVORITES },
      { label: 'Trash', icon: Trash2, path: ROUTES.PASSWORDS_TRASH },
    ],
  },
]

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const navigate = useNavigate()

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const currentApp = apps.find((app) => location.pathname.startsWith(app.basePath)) || apps[0]
  const primaryNav = currentApp.routes

  const handleOpenChange = (open: boolean) => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      if (sidebarOpen) setMenuPos({ top: rect.bottom + 8, left: rect.left })
      else setMenuPos({ top: rect.top, left: rect.right + 8 })
      setIsSwitcherOpen(true)
    } else setIsSwitcherOpen(false)
  }

  const handleSwitchApp = (path: string) => {
    navigate(path)
    setIsSwitcherOpen(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSwitcherOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    // Replaced framer-motion.aside with standard aside + CSS transitions
    <aside
      className="border-border/60 bg-sidebar relative flex h-full flex-col overflow-hidden border-r transition-all duration-300 ease-out"
      style={{ width: sidebarOpen ? 256 : 72 }}
    >
      <div className="flex h-[60px] shrink-0 items-center justify-between overflow-hidden px-3 pt-2">
        <div className="relative w-full">
          <button
            ref={triggerRef}
            onClick={() => handleOpenChange(!isSwitcherOpen)}
            className="hover:bg-sidebar-accent flex w-full items-center gap-3 rounded-lg p-2 transition-colors"
          >
            <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
              <Shield className="h-[17px] w-[17px]" strokeWidth={2.5} />
            </div>
            <div
              className={cn('flex flex-col text-left whitespace-nowrap', !sidebarOpen && 'hidden')}
            >
              <span className="text-sidebar-foreground text-[14px] leading-none font-semibold tracking-tight">
                Uoozer
              </span>
              <span className="text-sidebar-foreground/60 mt-1 flex items-center gap-1 text-[11px] font-medium">
                {currentApp.name} Workspace
                <ChevronsUpDown className="h-3 w-3" />
              </span>
            </div>
          </button>

          {isSwitcherOpen &&
            createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setIsSwitcherOpen(false)} />
                <div
                  className="bg-popover border-border/60 animate-scale-in fixed z-[9999] w-[240px] overflow-hidden rounded-xl border shadow-xl"
                  style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                >
                  <div className="border-border/60 border-b px-3 py-2">
                    <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Uoozer Account
                    </p>
                  </div>
                  <div className="p-1.5">
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => handleSwitchApp(app.basePath)}
                        className={cn(
                          'hover:bg-accent flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          currentApp.id === app.id && 'bg-accent/60'
                        )}
                      >
                        <app.icon
                          className="text-foreground/80 h-4 w-4 shrink-0"
                          strokeWidth={1.8}
                        />
                        <span className="text-foreground flex-1 text-[13px] font-medium">
                          {app.name}
                        </span>
                        {currentApp.id === app.id && <Check className="text-primary h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>,
              document.body
            )}
        </div>

        {sidebarOpen && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground h-7 w-7 shrink-0"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!sidebarOpen && (
        <div className="mb-2 flex shrink-0 justify-center px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground h-8 w-8"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
        {sidebarOpen && (
          <p className="text-sidebar-foreground/40 mb-2 px-3 text-[10px] font-bold tracking-wider uppercase">
            {currentApp.name}
          </p>
        )}
        <nav className="mb-6 space-y-1">
          {primaryNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium transition-colors duration-150',
                  sidebarOpen ? 'px-3' : 'justify-center px-2',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={cn('whitespace-nowrap', !sidebarOpen && 'hidden')}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {sidebarOpen && (
          <p className="text-sidebar-foreground/40 mb-2 px-3 text-[10px] font-bold tracking-wider uppercase">
            System
          </p>
        )}
        <nav className="space-y-1">
          {systemNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium transition-colors duration-150',
                  sidebarOpen ? 'px-3' : 'justify-center px-2',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className={cn('whitespace-nowrap', !sidebarOpen && 'hidden')}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-sidebar-border/70 space-y-3 border-t p-3">
        <div
          className={cn(
            'hover:bg-sidebar-accent/60 flex cursor-pointer items-center rounded-lg p-1.5 transition-colors',
            !sidebarOpen && 'justify-center'
          )}
        >
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          {sidebarOpen && user && (
            <div className="ml-2.5 min-w-0 flex-1 overflow-hidden">
              <p className="text-sidebar-foreground truncate text-[13px] leading-none font-medium">
                {user.email}
              </p>
              <p className="text-sidebar-foreground/50 mt-1 text-[11px]">Free Plan</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
