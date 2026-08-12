import { KeyRound, Smartphone, Fingerprint } from 'lucide-react'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Separator } from '@ui/Separator'

export function SecuritySection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[15px] font-semibold">Security</h3>
        <p className="text-muted-foreground/70 mt-0.5 text-[13px]">
          Manage your password and security settings.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-[13px] font-medium">Change Password</h4>
        <div className="space-y-3">
          <div className="relative">
            <KeyRound className="text-muted-foreground/60 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input type="password" placeholder="Current password" className="rounded-lg pl-9" />
          </div>
          <div className="relative">
            <KeyRound className="text-muted-foreground/60 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input type="password" placeholder="New password" className="rounded-lg pl-9" />
          </div>
          <Button variant="outline" className="rounded-lg">
            Update Password
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="text-[13px] font-medium">Two-Factor Authentication (2FA)</h4>
        <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="text-muted-foreground/70 h-5 w-5" />
            <div>
              <p className="text-[13px] font-medium">Authenticator App</p>
              <p className="text-muted-foreground/60 text-[11px]">Use an app to generate codes</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg">
            Enable
          </Button>
        </div>
        <div className="border-border/60 flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Fingerprint className="text-muted-foreground/70 h-5 w-5" />
            <div>
              <p className="text-[13px] font-medium">Biometric Login</p>
              <p className="text-muted-foreground/60 text-[11px]">Use Face ID or Fingerprint</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg">
            Enable
          </Button>
        </div>
      </div>
    </div>
  )
}
