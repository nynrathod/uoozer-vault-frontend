import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@ui/Button'
import { Switch } from '@ui/Switch'
import { SectionHeader } from '@/components/ui'
import { useState } from 'react'

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

export function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)
  const [securityAlerts, setSecurityAlerts] = useState(true)

  const handleSave = () => {
    toast.success('Notification preferences saved.')
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Notifications" description="Choose what updates you want to receive." />
      {/* ... (ToggleRows) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-1.5 rounded-lg">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>
    </div>
  )
}
