import { useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  Bell,
  Upload,
  Plus,
  Sun,
  Moon,
  Monitor,
  Settings,
  LogOut,
  User,
  Palette,
  ChevronRight,
  Check,
  HardDrive,
} from 'lucide-react'
import { Button } from '@ui/Button'
import { useUIStore } from '@stores/uiStore'
import { useAuthStore } from '@stores/authStore'
import { useTheme } from '@hooks/useTheme'
import { useClickOutside } from '@hooks/useClickOutside'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { SearchCommand } from '@/components/ui/overlays/SearchCommand'

const THEMES = [
  { id: 'default' as const, label: 'Uoozer Blue' },
  { id: 'uoozer' as const, label: 'Uoozer Amber' },
  { id: 'obsidian' as const, label: 'Obsidian Dark' },
  { id: 'slate' as const, label: 'Slate Gray' },
  { id: 'forest' as const, label: 'Forest Green' },
]

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const setSearchOpen = useUIStore((s) => s.setSearchOpen)
  const setUploadPanelOpen = useUIStore((s) => s.setUploadPanelOpen)

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const { variant, scheme, resolvedTheme, setVariant, setScheme, toggleTheme } = useTheme()

  const [profileOpen, setProfileOpen] = useState(false)
  const [themeSubmenu, setThemeSubmenu] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useClickOutside(profileRef, () => {
    setProfileOpen(false)
    setThemeSubmenu(false)
  })

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

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground relative h-9 w-9 rounded-lg"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="bg-primary ring-background absolute top-2 right-2 h-2 w-2 rounded-full ring-2" />
        </Button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setProfileOpen(!profileOpen)
              setThemeSubmenu(false)
            }}
            className="bg-secondary text-foreground hover:bg-secondary/80 ml-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors"
          >
            {user?.email ? (
              <span className="text-[13px]">{user.email.charAt(0).toUpperCase()}</span>
            ) : (
              <User className="text-muted-foreground h-[18px] w-[18px]" />
            )}
          </button>

          {profileOpen && (
            <div className="bg-popover border-border/60 animate-scale-in absolute top-full right-0 z-50 mt-2 w-[300px] origin-top-right overflow-hidden rounded-2xl border shadow-2xl">
              <div className="border-border/60 border-b p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold">
                    {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[13px] font-medium">
                      {user?.email?.split('@')[0].replace(/^\w/, (c) => c.toUpperCase()) ||
                        'Guest User'}
                    </p>
                    <p className="text-muted-foreground/80 truncate text-[11px]">
                      {user?.email || 'No email'}
                    </p>
                  </div>
                </div>
                <div className="border-border/50 bg-muted/30 mt-4 rounded-xl border p-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">
                      Free Plan · 5.18 MB / 2 GB
                    </span>
                  </div>
                  <div className="bg-border h-1.5 w-full overflow-hidden rounded-full">
                    <div className="bg-primary h-full w-[1%] rounded-full"></div>
                  </div>
                  <button className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium transition-colors">
                    Upgrade to Pro
                  </button>
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    navigate(ROUTES.SETTINGS)
                  }}
                  className="text-foreground hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors"
                >
                  <Settings className="text-muted-foreground/70 h-4 w-4" /> Settings
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    navigate(ROUTES.DEVICES)
                  }}
                  className="text-foreground hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors"
                >
                  <HardDrive className="text-muted-foreground/70 h-4 w-4" /> Manage Devices
                </button>

                <div className="relative mt-0.5">
                  <button
                    onClick={() => setThemeSubmenu(!themeSubmenu)}
                    className="text-foreground hover:bg-accent flex w-full items-center justify-between rounded-lg px-2.5 py-[7px] text-[13px] transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Palette className="text-muted-foreground/70 h-4 w-4" /> Appearance
                    </span>
                    <ChevronRight
                      className={cn(
                        'text-muted-foreground/50 h-3.5 w-3.5 transition-transform',
                        themeSubmenu && 'rotate-90'
                      )}
                    />
                  </button>

                  {themeSubmenu && (
                    <div className="border-border/60 mt-1 ml-4 space-y-1 border-l pl-2">
                      <div className="text-muted-foreground/50 px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                        Mode
                      </div>
                      {(
                        [
                          { id: 'light', label: 'Light', icon: Sun },
                          { id: 'dark', label: 'Dark', icon: Moon },
                          { id: 'system', label: 'System', icon: Monitor },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setScheme(s.id)}
                          className="text-foreground hover:bg-accent flex w-full items-center justify-between rounded-lg px-2.5 py-[6px] text-[13px] transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <s.icon className="text-muted-foreground/60 h-4 w-4" /> {s.label}
                          </span>
                          {scheme === s.id && (
                            <Check className="text-primary h-3.5 w-3.5" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                      <div className="text-muted-foreground/50 px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                        Color
                      </div>
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setVariant(t.id)}
                          className="text-foreground hover:bg-accent flex w-full items-center justify-between rounded-lg px-2.5 py-[6px] text-[13px] transition-colors"
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className="border-border/60 h-3.5 w-3.5 rounded-full border"
                              style={{
                                background:
                                  t.id === 'default'
                                    ? '#0061FE'
                                    : t.id === 'uoozer'
                                      ? '#F5A623'
                                      : t.id === 'obsidian'
                                        ? '#4F8CFF'
                                        : t.id === 'slate'
                                          ? '#4A5568'
                                          : '#2F855A',
                              }}
                            />
                            <span>{t.label}</span>
                          </span>
                          {variant === t.id && (
                            <Check className="text-primary h-3.5 w-3.5" strokeWidth={3} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-border/60 border-t p-2">
                <button
                  onClick={() => {
                    setProfileOpen(false)
                    logout()
                    navigate(ROUTES.LOGIN)
                  }}
                  className="text-foreground hover:bg-accent flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors"
                >
                  <LogOut className="text-muted-foreground/70 h-4 w-4" /> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
