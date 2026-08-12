import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, User, HardDrive } from 'lucide-react'
import { useAuthStore } from '@stores/authStore'
import { useUIStore } from '@stores/uiStore'
import { useTheme } from '@hooks/useTheme'
import { useClickOutside } from '@hooks/useClickOutside'
import { ROUTES } from '@lib/constants'
import { ThemeSubMenu } from './ThemeSubMenu'

export function ProfileDropdown() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { variant, scheme, setVariant, setScheme } = useTheme()

  const [profileOpen, setProfileOpen] = useState(false)
  const [themeSubmenu, setThemeSubmenu] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useClickOutside(profileRef, () => {
    setProfileOpen(false)
    setThemeSubmenu(false)
  })

  return (
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

            <ThemeSubMenu
              variant={variant}
              scheme={scheme}
              setVariant={setVariant}
              setScheme={setScheme}
              themeSubmenu={themeSubmenu}
              setThemeSubmenu={setThemeSubmenu}
            />
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
  )
}
