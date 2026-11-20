import { useLocation, useNavigate } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/Popover'
import { Check, ChevronsUpDown, FolderOpen, StickyNote } from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { useAuthStore } from '@stores/authStore'

/**
 * Workspace switcher that lives at the top of the sidebar.
 *
 * Shell spec ("Workspace · dropdown" — rendered markup is ground truth):
 *   trigger   38 high · radius 6 · Active fill (always tinted) · 22×22 Blue
 *             tile · name 14/600 ink · plan 12.5 muted · chevron 14 ghost
 *   dropdown  288 wide · radius 12 · padding 6 · menu elevation · opens
 *             DOWNWARD (bottom) per product decision · label 12/500 ·
 *             items 44 high (r6, 10px padding, 22 tile, 13.5/500 name,
 *             12 sub, lh 18) · secondary items 34 high
 *   apps      Vault and Notes stay reachable from the same dropdown, each
 *             with a real route — no dummy entries.
 */
const APPS = [
  {
    id: 'vault',
    name: 'Files',
    sub: 'Encrypted storage',
    icon: FolderOpen,
    basePath: ROUTES.VAULT,
  },
  {
    id: 'notes',
    name: 'Notes',
    sub: 'Encrypted notes',
    icon: StickyNote,
    basePath: ROUTES.NOTES,
  },
] as const

export function WorkspaceMenu({ sidebarOpen }: { sidebarOpen: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)

  const currentApp = APPS.find((app) => pathname.startsWith(app.basePath)) ?? APPS[0]
  const initial = (user?.email?.charAt(0) || 'U').toUpperCase()

  const go = (path: string) => {
    navigate(path)
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'focus-visible:outline-ring bg-active-surface hover:bg-hover-surface w-full rounded-sm outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms]',
          sidebarOpen
            ? 'flex h-[38px] items-center gap-2 px-2'
            : 'mx-auto flex h-[38px] w-[38px] items-center justify-center'
        )}
        aria-label="Switch workspace"
      >
        {sidebarOpen ? (
          <>
            {/* Avatar tile — Blue square, radius 6, white initial (22×22) */}
            <span className="bg-primary text-primary-foreground flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm text-[12px] font-semibold">
              {initial}
            </span>
            <span className="text-ink truncate text-[14px] leading-[20px] font-semibold">
              Uoozer
            </span>
            <span className="text-muted-foreground truncate text-[12.5px] leading-[20px]">
              Personal
            </span>
            <ChevronsUpDown className="text-ghost ml-auto h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
          </>
        ) : (
          <span className="bg-primary text-primary-foreground flex h-[22px] w-[22px] items-center justify-center rounded-sm text-[12px] font-semibold">
            {initial}
          </span>
        )}
      </PopoverTrigger>

      {/* Opens downward (bottom) from the header — per product decision. */}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="bg-popover text-popover-foreground animate-scale-in shadow-menu w-[240px] rounded-xl p-1.5 outline-none"
      >
        {/* Section label — 12/16 · 500 */}
        {/* <p className="text-muted-foreground px-2.5 pt-2 pb-1 text-[12px] leading-4 font-medium">
          Workspaces
        </p> */}

        {/* The personal workspace — real account, always selected for now. */}
        {/* <div className="bg-active-surface flex h-11 items-center gap-2.5 rounded-sm px-2.5">
          <span className="bg-primary text-primary-foreground flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm text-[12px] font-semibold">
            {initial}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-[18px]">
            <span className="text-ink truncate text-[13.5px] font-medium">Personal</span>
            <span className="text-muted-foreground truncate text-[12px]">Free plan · only you</span>
          </span>
          <span className="text-muted-foreground text-[12px]">✓</span>
        </div> */}

        {/* Apps — Vault and Notes stay reachable from this dropdown. */}
        <p className="text-muted-foreground px-2.5 pt-2 pb-1 text-[12px] leading-4 font-medium">
          Apps
        </p>
        {APPS.map((app) => {
          const active = currentApp.id === app.id
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => go(app.basePath)}
              className={cn(
                'focus-visible:outline-ring flex h-11 w-full items-center gap-2.5 rounded-sm px-2.5 text-left outline outline-2 outline-offset-2 outline-transparent transition-colors duration-[120ms]',
                active ? 'bg-active-surface' : 'hover:bg-active-surface'
              )}
            >
              <app.icon
                className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-ghost')}
                strokeWidth={1.6}
              />
              <span className="flex min-w-0 flex-1 flex-col leading-[18px]">
                <span
                  className={cn(
                    'truncate text-[13.5px]',
                    active ? 'text-ink font-medium' : 'text-gray-ui'
                  )}
                >
                  {app.name}
                </span>
                <span className="text-muted-foreground truncate text-[12px]">{app.sub}</span>
              </span>
              {active && <span className="text-muted-foreground text-[12px]">✓</span>}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
