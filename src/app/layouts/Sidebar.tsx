import { type CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  FolderOpen,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { UI_CONFIG } from '@config/app'
import { useUIStore } from '@stores/uiStore'
import { Button } from '@ui/Button'
import { WorkspaceMenu } from './WorkspaceMenu'
import { AccountMenu } from './AccountMenu'
import { NotesSidebarNav } from '@/modules/notes/components/NotesSidebarNav'

const APP_ROWS = [
  { id: 'vault', label: 'Files', icon: FolderOpen, path: ROUTES.VAULT },
  { id: 'notes', label: 'Notes', icon: StickyNote, path: ROUTES.NOTES },
] as const

const SOON_ROWS = [{ label: 'Chat', icon: MessageSquare }] as const

const LIBRARY = [
  { label: 'All files', icon: FolderOpen, path: ROUTES.VAULT, end: true },
  // { label: 'Recent', icon: Clock, path: ROUTES.VAULT_RECENT },
  // { label: 'Starred', icon: Star, path: ROUTES.VAULT_STARRED },
  // { label: 'Shared', icon: LinkIcon, path: ROUTES.VAULT_SHARED },
  // { label: 'Private', icon: Lock, path: ROUTES.VAULT_PRIVATE },
  { label: 'Trash', icon: Trash2, path: ROUTES.VAULT_TRASH },
] as const

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const mobileMenuOpen = useUIStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen)

  const setSearchOpen = useUIStore((s) => s.setSearchOpen)

  const { pathname } = useLocation()
  const isNotesApp = pathname.startsWith('/notes')

  // Always show expanded content inside the mobile drawer.
  const isExpanded = sidebarOpen || mobileMenuOpen

  // Live storage usage.
  // const usedBytes = useFileStore((s) => {
  //   let total = 0

  //   s.files.forEach((file) => {
  //     if (!file.deletedAt) total += file.totalSize
  //   })

  //   return total
  // })

  // const usedLabel = useMemo(() => formatBytes(usedBytes), [usedBytes])
  // const quotaLabel = formatBytes(FREE_PLAN_QUOTA_BYTES)

  // const usedPercent = Math.min(100, Math.round((usedBytes / FREE_PLAN_QUOTA_BYTES) * 100))

  const rowClass = (isActive: boolean) =>
    cn(
      'focus-visible:outline-ring flex h-[30px] items-center gap-2.5 rounded-sm text-[13.5px] leading-[30px] font-medium outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms]',
      isExpanded ? 'px-2' : 'justify-center px-0',
      isActive
        ? 'bg-active-surface text-ink [&>svg]:text-primary'
        : 'text-gray-strong hover:bg-hover-surface [&>svg]:text-ghost'
    )

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeMobileMenu}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          'bg-sidebar shadow-card - duration - [180ms] ease - out fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(85vw,var(--sidebar-expanded-width))] shrink-0 transform flex-col overflow-hidden px-2.5 pt-3.5 pb-3 transition duration-250 lg:transition-[width,transform] lg:duration-250 lg:ease-out',
          'lg:relative lg:inset-auto lg:z-40 lg:h-full lg:translate-x-0 lg:transition-[width]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          'lg:w-(--sidebar-current-width)'
        )}
        style={
          {
            '--sidebar-expanded-width': `${UI_CONFIG.sidebarWidth}px`,
            '--sidebar-current-width': `${
              sidebarOpen ? UI_CONFIG.sidebarWidth : UI_CONFIG.sidebarCollapsedWidth
            }px`,
          } as CSSProperties
        }
        onClick={(event) => {
          // Close mobile drawer after navigation.
          if (event.target instanceof Element && event.target.closest('a')) {
            closeMobileMenu()
          }
        }}
      >
        {/* Workspace header */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="min-w-0 flex-1">
            <WorkspaceMenu sidebarOpen={isExpanded} />
          </div>

          {/* Desktop collapse button */}
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="text-ghost hover:bg-hover-surface hover:text-ink hidden shrink-0 lg:flex"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.6} />
            </Button>
          )}

          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobileMenu}
            aria-label="Close sidebar"
            className="text-ghost hover:bg-hover-surface hover:text-ink shrink-0 lg:hidden"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </Button>
        </div>

        {/* Desktop expand button */}
        {!sidebarOpen && (
          <div className="mt-2 hidden shrink-0 justify-center lg:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              className="text-ghost hover:bg-hover-surface hover:text-ink"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.6} />
            </Button>
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 pt-2',
            isNotesApp ? 'flex flex-col overflow-hidden' : 'overflow-x-hidden overflow-y-auto'
          )}
        >
          {/* App navigation */}
          <nav className="shrink-0 space-y-px">
            {APP_ROWS.map((app) => (
              <NavLink
                key={app.id}
                to={app.path}
                title={app.label}
                className={({ isActive }) => rowClass(isActive)}
              >
                <app.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                {isExpanded && <span className="truncate">{app.label}</span>}
              </NavLink>
            ))}

            {/* Coming soon apps */}
            {SOON_ROWS.map((row) => (
              <button
                key={row.label}
                type="button"
                disabled
                title={`${row.label} - coming soon`}
                className={cn(
                  'text-ghost flex h-7.5 w-full cursor-default items-center gap-2.5 rounded-sm text-[13.5px] leading-7.5 font-normal',
                  isExpanded ? 'px-2' : 'justify-center px-0'
                )}
              >
                <row.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />

                {isExpanded && (
                  <>
                    <span className="flex-1 truncate text-left">{row.label}</span>
                    <span className="text-muted-foreground text-[11.5px]">Soon</span>
                  </>
                )}
              </button>
            ))}
          </nav>

          {/* Search */}
          <button
            type="button"
            onClick={() => {
              setSearchOpen(true)
              closeMobileMenu()
            }}
            title="Search (⌘K)"
            className={cn(
              'text-gray-strong hover:bg-hover-surface mt-3 flex h-7.5 w-full shrink-0 items-center gap-2.5 rounded-sm text-[13.5px] leading-7.5 transition-colors duration-120',
              isExpanded ? 'px-2' : 'justify-center px-0'
            )}
          >
            <Search className="text-ghost h-4 w-4 shrink-0" strokeWidth={1.6} />

            {isExpanded && (
              <>
                <span className="flex-1 truncate text-left">Search</span>
                <span className="text-muted-foreground text-[11.5px] tabular-nums">⌘K</span>
              </>
            )}
          </button>

          {/* Library / Notes navigation */}
          {isNotesApp ? (
            <NotesSidebarNav open={isExpanded} />
          ) : (
            <>
              {isExpanded && (
                <p className="text-muted-foreground mt-4 mb-1.5 px-2 text-[12px] leading-4 font-medium">
                  Library
                </p>
              )}

              <nav className="shrink-0 space-y-px">
                {LIBRARY.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={'end' in item && item.end}
                    title={item.label}
                    className={({ isActive }) => rowClass(isActive)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />

                    {isExpanded && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </nav>
            </>
          )}
        </div>

        {/* Storage usage */}
        {/* {isExpanded && (
          <div className="px-2 pt-1 pb-2.5">
            <div className="text-muted-foreground flex items-baseline justify-between text-[12px] leading-4">
              <span className="tabular-nums">
                {usedLabel} of {quotaLabel}
              </span>
              <span>Free plan</span>
            </div>

            <div className="bg-line mt-1.5 h-[3px] w-full overflow-hidden rounded-[2px]">
              <div
                className="bg-primary h-full rounded-[2px] transition-[width] duration-200"
                style={{
                  width: `${Math.max(usedPercent, usedBytes > 0 ? 1 : 0)}%`,
                }}
              />
            </div>
          </div>
        )} */}

        {/* Account */}
        <div className="shrink-0">
          <AccountMenu sidebarOpen={isExpanded} />
        </div>
      </aside>
    </>
  )
}
