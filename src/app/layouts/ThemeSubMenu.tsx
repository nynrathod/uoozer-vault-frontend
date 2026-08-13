import { useState } from 'react'
import { Palette, ChevronRight, Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@lib/utils'
import { useTheme } from '@hooks/useTheme'
import { CheckableMenuItem } from '@/components/ui'

const THEMES = [
  { id: 'default' as const, label: 'Uoozer Blue', color: '#0061FE' },
  { id: 'uoozer' as const, label: 'Uoozer Amber', color: '#F5A623' },
  { id: 'obsidian' as const, label: 'Obsidian Dark', color: '#4F8CFF' },
  { id: 'slate' as const, label: 'Slate Gray', color: '#4A5568' },
  { id: 'forest' as const, label: 'Forest Green', color: '#2F855A' },
]

/** Color-scheme and theme variant selector nested inside the profile dropdown. */
export function ThemeSubMenu() {
  const { variant, scheme, setVariant, setScheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative mt-0.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-foreground hover:bg-accent flex w-full items-center justify-between rounded-lg px-2.5 py-[7px] text-[13px] transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <Palette className="text-muted-foreground/70 h-4 w-4" /> Appearance
        </span>
        <ChevronRight
          className={cn(
            'text-muted-foreground/50 h-3.5 w-3.5 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
      </button>

      {isOpen && (
        <div className="border-border/60 mt-1 ml-4 space-y-1 border-l pl-2">
          <div className="text-muted-foreground/50 px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider uppercase">
            Mode
          </div>
          <CheckableMenuItem
            label="Light"
            icon={Sun}
            isActive={scheme === 'light'}
            onClick={() => setScheme('light')}
          />
          <CheckableMenuItem
            label="Dark"
            icon={Moon}
            isActive={scheme === 'dark'}
            onClick={() => setScheme('dark')}
          />
          <CheckableMenuItem
            label="System"
            icon={Monitor}
            isActive={scheme === 'system'}
            onClick={() => setScheme('system')}
          />

          <div className="text-muted-foreground/50 px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
            Color
          </div>
          {THEMES.map((t) => (
            <CheckableMenuItem
              key={t.id}
              label={t.label}
              isActive={variant === t.id}
              onClick={() => setVariant(t.id)}
              leading={
                <span
                  className="border-border/60 h-3.5 w-3.5 rounded-full border"
                  style={{ background: `var(--color-theme-${t.id})` }}
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
