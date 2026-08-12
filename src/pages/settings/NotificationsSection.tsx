import { useState } from 'react'
import { Save, Check } from 'lucide-react'
import { Button } from '@ui/Button'
import { cn } from '@lib/utils'

function ToggleRow({ title, description, checked, onChange }: any) {
  return (
    <div className="border-border/60 flex items-center justify-between border-b py-3 last:border-b-0">
      <div className="pr-4">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-muted-foreground/60 text-[11px]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-secondary border-border border'
        )}
      >
        <span
          className={cn(
            'bg-background absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)
  const [securityAlerts, setSecurityAlerts] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[15px] font-semibold">Notifications</h3>
        <p className="text-muted-foreground/70 mt-0.5 text-[13px]">
          Choose what updates you want to receive.
        </p>
      </div>
      <div className="space-y-1">
        <ToggleRow
          title="Email Notifications"
          description="Get notified about file activity and shares"
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />
        <ToggleRow
          title="Product Updates"
          description="News about new features and improvements"
          checked={productUpdates}
          onChange={setProductUpdates}
        />
        <ToggleRow
          title="Security Alerts"
          description="Important alerts about your account security"
          checked={securityAlerts}
          onChange={setSecurityAlerts}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-1.5 rounded-lg">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
