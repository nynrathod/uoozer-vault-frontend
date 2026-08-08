import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FolderOpen,
  StickyNote,
  Settings,
  Shield,
  HardDrive,
  Activity,
  ChevronLeft,
  ChevronRight,
  Cloud,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useUIStore } from '@stores/uiStore'
import { useAuthStore } from '@stores/authStore'
import { Button } from '@ui/Button'

const apps = [
  { label: 'Vault', icon: FolderOpen, path: ROUTES.VAULT },
  { label: 'Notes', icon: StickyNote, path: ROUTES.NOTES },
]

const systemNav = [
  { label: 'Devices', icon: HardDrive, path: ROUTES.DEVICES },
  { label: 'Audit Logs', icon: Activity, path: ROUTES.AUDIT_LOGS },
  { label: 'Settings', icon: Settings, path: ROUTES.SETTINGS },
]

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 256 : 72 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="border-border/60 bg-sidebar flex h-full flex-col border-r"
    >
      {/* Logo area */}
      <div className="flex h-[60px] items-center justify-between overflow-hidden px-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <Shield className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </div>
          <div
            className={cn(
              'flex flex-col whitespace-nowrap transition-opacity duration-200',
              !sidebarOpen ? 'w-0 opacity-0' : 'opacity-100'
            )}
          >
            <span className="text-sidebar-foreground text-[15px] leading-none font-semibold tracking-tight">
              Uoozer
            </span>
            <span className="text-sidebar-foreground/50 mt-0.5 text-[11px] font-medium">
              Secure Workspace
            </span>
          </div>
        </div>
        {sidebarOpen && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground h-8 w-8 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {!sidebarOpen && (
        <div className="mb-2 flex justify-center px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {/* APPS SECTION */}
        {sidebarOpen && (
          <p className="text-sidebar-foreground/40 mb-2 px-3 text-[10px] font-bold tracking-wider uppercase">
            Apps
          </p>
        )}
        <nav className="mb-6 space-y-1">
          {apps.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity duration-200',
                  !sidebarOpen ? 'w-0 opacity-0' : 'opacity-100'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* SYSTEM SECTION */}
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
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity duration-200',
                  !sidebarOpen ? 'w-0 opacity-0' : 'opacity-100'
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Storage Section */}
      <div className="border-sidebar-border/70 border-t p-3">
        {sidebarOpen ? (
          <div className="space-y-3 px-2 py-2">
            <div className="flex items-center gap-2.5">
              <Cloud className="text-primary/80 h-4 w-4" strokeWidth={1.8} />
              <div className="flex-1">
                <p className="text-sidebar-foreground text-[12px] leading-none font-medium">
                  Storage
                </p>
                <p className="text-sidebar-foreground/50 mt-1 text-[11px]">5.18 MB of 2 GB used</p>
              </div>
            </div>
            <div className="bg-sidebar-border/80 h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-primary h-full w-[2%] rounded-full"></div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <div
              className="border-sidebar-border/80 border-t-primary/80 h-6 w-6 animate-spin rounded-full border-2"
              style={{ animationDuration: '3s' }}
            ></div>
          </div>
        )}

        {/* User Profile */}
        <div
          className={cn(
            'hover:bg-sidebar-accent/60 mt-2 flex cursor-pointer items-center rounded-lg p-1.5 transition-colors',
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
    </motion.aside>
  )
}
