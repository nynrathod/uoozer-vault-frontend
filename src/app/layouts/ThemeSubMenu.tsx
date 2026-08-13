import { Palette, ChevronRight, Check, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@lib/utils'
import type { ThemeVariant, ColorScheme } from '@hooks/useTheme'

const THEMES = [
  { id: 'default' as const, label: 'Uoozer Blue' },
  { id: 'uoozer' as const, label: 'Uoozer Amber' },
  { id: 'obsidian' as const, label: 'Obsidian Dark' },
  { id: 'slate' as const, label: 'Slate Gray' },
  { id: 'forest' as const, label: 'Forest Green' },
]

interface ThemeSubMenuProps {
  variant: ThemeVariant
  scheme: ColorScheme
  setVariant: (v: ThemeVariant) => void
  setScheme: (s: ColorScheme) => void
  themeSubmenu: boolean
  setThemeSubmenu: (v: boolean) => void
}

export function ThemeSubMenu({
  variant,
  scheme,
  setVariant,
  setScheme,
  themeSubmenu,
  setThemeSubmenu,
}: ThemeSubMenuProps) {
  return (
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
              {scheme === s.id && <Check className="text-primary h-3.5 w-3.5" strokeWidth={3} />}
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
              {variant === t.id && <Check className="text-primary h-3.5 w-3.5" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
