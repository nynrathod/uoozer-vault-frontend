import { Popover, PopoverContent, PopoverTrigger } from '@ui/Popover'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, ChevronsUpDown, HardDrive, Keyboard, Lock, LogOut, Settings } from 'lucide-react'
import { cn } from '@lib/utils'
import { QUERY_KEYS, ROUTES } from '@lib/constants'
import { authService } from '@services/auth/authService'
import { useAuthStore } from '@stores/authStore'
import { useUIStore } from '@stores/uiStore'
import { useVaultLock } from '@hooks/useVaultLock'

/**
 * Account row pinned to the bottom-left of the sidebar.
 *
 * Shell spec ("Account · bottom-left email" — rendered markup is ground
 * truth): 36-high trigger · Active fill · 22px Tint circle with blue-ink
 * initial · email 13 · chevron 14. Its menu opens UPWARD: 288 wide,
 * radius 12, padding 6, menu elevation; header 32px Tint avatar;
 * items 34 high, 13.5, icons 16 ghost, kbd 12 muted.
 *
 * Every item below is a real, working action: routes exist, the devices
 * count is live and the lock wipes the device keys.
 */

const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="text-muted-foreground ml-auto text-[12px] tabular-nums">{children}</span>
)

export function AccountMenu({ sidebarOpen }: { sidebarOpen: boolean }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)
  const lockVault = useVaultLock()

  const { data: devices } = useQuery({
    queryKey: [QUERY_KEYS.AUTH.DEVICES],
    queryFn: () => authService.getDevices(),
    retry: 0,
    staleTime: 60_000,
  })

  const email = user?.email ?? ''
  const initial = (email.charAt(0) || 'U').toUpperCase()
  const displayName = user?.fullName?.trim() || email.split('@')[0] || 'Guest User'
  const deviceCount = devices?.length

  const item =
    'focus-visible:outline-ring hover:bg-active-surface flex h-[34px] w-full items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] text-gray-ui outline outline-offset-2 outline-2 outline-transparent transition-colors duration-[120ms]'

  const signOut = async () => {
    await logout()
    navigate(ROUTES.LOGIN, { replace: true })
  }

  const menuItems = [
    {
      label: 'Devices',
      icon: HardDrive,
      action: () => navigate(ROUTES.DEVICES),
      value: typeof deviceCount === 'number' ? String(deviceCount) : undefined,
    },
    {
      label: 'Audit logs',
      icon: Activity,
      action: () => navigate(ROUTES.AUDIT_LOGS),
    },
    {
      label: 'Settings',
      icon: Settings,
      action: () => navigate(ROUTES.SETTINGS),
      shortcut: '⌘,',
    },
    {
      label: 'Keyboard shortcuts',
      icon: Keyboard,
      action: () => setShortcutsOpen(true),
      shortcut: '⌘/',
    },
    {
      label: 'Lock vault',
      icon: Lock,
      action: () => void lockVault(),
      shortcut: '⌘⇧L',
    },
    {
      label: 'Sign out',
      icon: LogOut,
      action: () => void signOut(),
      danger: true,
    },
  ]

  const [popoverOpen, setPopoverOpen] = useState(false)

  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen)

  const runAndClose = (action: () => void) => {
    setPopoverOpen(false)
    setMobileMenuOpen(false)
    action()
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger
        className={cn(
          'focus-visible:outline-ring bg-active-surface hover:bg-hover-surface w-full rounded-sm outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms]',
          sidebarOpen
            ? 'flex h-9 items-center gap-2 px-2'
            : 'mx-auto flex h-9 w-9 items-center justify-center'
        )}
        aria-label="Open account menu"
      >
        {sidebarOpen ? (
          <>
            {/* Avatar — Tint circle, blue-ink initial (22×22) */}
            <span className="bg-tint text-blue-ink flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold">
              {initial}
            </span>
            <span className="text-gray-ui min-w-0 flex-1 truncate text-left text-[13px]">
              {email || 'Guest User'}
            </span>
            <ChevronsUpDown className="text-ghost h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
          </>
        ) : (
          <span className="bg-tint text-blue-ink flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-semibold">
            {initial}
          </span>
        )}
      </PopoverTrigger>

      {/* Opens upward — it lives at the very bottom of the sidebar. */}
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="bg-popover text-popover-foreground animate-scale-in shadow-menu w-[288px] rounded-xl p-1.5 outline-none"
      >
        {/* Header — 32px Tint avatar, name 13.5/600, email 12 muted */}
        <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5">
          <span className="bg-tint text-blue-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold">
            {initial}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-[18px]">
            <span className="text-ink truncate text-[13.5px] font-semibold">{displayName}</span>
            <span className="text-muted-foreground truncate text-[12px]">
              {email || 'No email'}
            </span>
          </span>
        </div>

        {menuItems.map((menuItem) => {
          const Icon = menuItem.icon

          return (
            <button
              key={menuItem.label}
              type="button"
              onClick={() => runAndClose(menuItem.action)}
              className={cn(item, menuItem.danger && 'text-failed hover:bg-active-surface')}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', menuItem.danger ? 'text-failed' : 'text-ghost')}
                strokeWidth={1.6}
              />

              <span className="flex-1 text-left">{menuItem.label}</span>

              {menuItem.value && <Kbd>{menuItem.value}</Kbd>}
              {menuItem.shortcut && <Kbd>{menuItem.shortcut}</Kbd>}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
