import { useState } from 'react'
import { Check, Copy, Key, AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@ui/Button'
import { cn } from '@lib/utils'
import { useClipboard } from '@hooks/useClipboard'

interface RecoveryKeyDisplayProps {
  recoveryKey: string
  onContinue: () => void
}

/** Displays the one-time recovery key and requires user acknowledgment before continuing. */
export function RecoveryKeyDisplay({ recoveryKey, onContinue }: RecoveryKeyDisplayProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const { copied, copy } = useClipboard()

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Key className="h-4 w-4" />
          <span className="text-[13px] font-semibold">Recovery Key</span>
        </div>
        <p className="text-muted-foreground mb-3 text-[12px] leading-relaxed">
          Save this key somewhere safe (password manager, printed copy). You will{' '}
          <strong className="text-foreground">never</strong> see it again.
        </p>
        <div className="flex items-center gap-2">
          <code className="bg-background flex-1 truncate rounded-lg border px-3 py-2.5 font-mono text-[12px] tracking-wider">
            {recoveryKey}
          </code>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => copy(recoveryKey)}
            className={cn('h-10 w-10 shrink-0', copied && 'text-emerald-500')}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="border-destructive/20 bg-destructive/5 flex gap-3 rounded-xl border p-4">
        <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-foreground text-[12px] font-medium">
            What happens if I lose this key?
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Your data is encrypted with your password. If you forget your password{' '}
            <strong className="text-foreground">and</strong> don't have this recovery key, your data
            is <strong className="text-foreground">permanently lost</strong>. No one, including
            Uoozer, can recover it.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="border-border text-primary focus:ring-primary mt-0.5 h-4 w-4 rounded"
        />
        <span className="text-muted-foreground">
          I have saved my recovery key and understand that losing both my password and recovery key
          means permanent data loss.
        </span>
      </label>

      <Button onClick={onContinue} disabled={!acknowledged} className="h-10 w-full rounded-lg">
        I've saved it — go to my vault
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
