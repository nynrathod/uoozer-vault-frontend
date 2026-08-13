import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { Separator } from '@ui/Separator'
import { cn } from '@lib/utils'

const THEMES = [
  { id: 'default' as const, label: 'Uoozer Blue', color: '#0061FE' },
  { id: 'uoozer' as const, label: 'Uoozer Amber', color: '#F5A623' },
  { id: 'obsidian' as const, label: 'Obsidian Dark', color: '#4F8CFF' },
  { id: 'slate' as const, label: 'Slate Gray', color: '#4A5568' },
  { id: 'forest' as const, label: 'Forest Green', color: '#2F855A' },
]

/** Settings section for choosing light/dark/system mode and accent color theme. */
export function AppearanceSection({ variant, scheme, setVariant, setScheme }: any) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[15px] font-semibold">Appearance</h3>
        <p className="text-muted-foreground/70 mt-0.5 text-[13px]">
          Customize how Uoozer Vault looks for you.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-[13px] font-medium">Theme Mode</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Monitor },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setScheme(s.id)}
              className={cn(
                'border-border flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                scheme === s.id ? 'border-primary bg-primary/[0.04]' : 'hover:bg-accent/50'
              )}
            >
              <s.icon
                className={cn(
                  'h-5 w-5',
                  scheme === s.id ? 'text-primary' : 'text-muted-foreground/70'
                )}
              />
              <span className="text-[13px] font-medium">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-[13px] font-medium">Accent Color</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setVariant(t.id)}
              className={cn(
                'border-border flex items-center gap-3 rounded-lg border p-3 transition-all',
                variant === t.id ? 'border-primary bg-primary/[0.04]' : 'hover:bg-accent/50'
              )}
            >
              <span
                className="h-6 w-6 rounded-full border border-black/10 dark:border-white/10"
                style={{ background: t.color }}
              />
              <span className="text-[13px] font-medium">{t.label}</span>
              {variant === t.id && <Check className="text-primary ml-auto h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
