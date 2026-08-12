import { Camera, Mail, Save, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Separator } from '@ui/Separator'

export function ProfileSection({ user }: { user: any }) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[15px] font-semibold">Profile</h3>
        <p className="text-muted-foreground/70 mt-0.5 text-[13px]">
          Update your personal information.
        </p>
      </div>

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
          <Input defaultValue="Nayan Rathod" className="rounded-lg" />
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
        <h3 className="text-[15px] font-semibold">Preferences</h3>
        <div className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Language</label>
            <select className="border-border bg-background focus-visible:border-primary/60 flex h-10 w-full rounded-lg border px-3 text-[13px] outline-none">
              <option>English (United States)</option>
              <option>Spanish (Spain)</option>
              <option>French (France)</option>
            </select>
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
