import { Camera, Mail, Save, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Separator } from '@ui/Separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { SectionHeader } from '@/components/ui'

/** Settings section for editing name, avatar, email (read-only), and language preference. */
export function ProfileSection({ user }: { user: any }) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    toast.success('Profile updated successfully.')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Profile" description="Update your personal information." />

      <div className="flex items-center gap-4">
        <div className="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold">
          {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-lg">
          <Camera className="h-4 w-4" /> Change Avatar
        </Button>
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Full Name</label>
          <Input defaultValue={user?.fullName || ''} className="rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Email Address</label>
          <div className="relative">
            <Mail className="text-muted-foreground/60 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              defaultValue={user?.email || 'nayan@example.com'}
              className="rounded-lg pl-9"
              disabled
            />
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <SectionHeader title="Preferences" />
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Language</label>
            <Select defaultValue="en-US">
              <SelectTrigger className="w-full rounded-lg">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (United States)</SelectItem>
                <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                <SelectItem value="fr-FR">French (France)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
