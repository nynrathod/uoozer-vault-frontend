import { useState } from 'react'
import { Save, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@ui/Button'
import { Switch } from '@ui/Switch'
import { SectionHeader } from '@/components/ui'

/** Reusable settings row with a label, description, and toggle switch. */
function ToggleRow({ title, description, checked, onChange }: any) {
  return (
    <div className="border-border/60 flex items-center justify-between border-b py-3 last:border-b-0">
      <div className="pr-4">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-muted-foreground/60 text-[11px]">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** Settings section for toggling email, product, and security notification preferences. */
export function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)
  const [securityAlerts, setSecurityAlerts] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    toast.success('Notification preferences saved.')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Notifications" description="Choose what updates you want to receive." />
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
