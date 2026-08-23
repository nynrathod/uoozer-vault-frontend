import { useState } from 'react'
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
} from 'lucide-react'
import { cn } from '@lib/utils'
import { Button } from '@ui/Button'
import { mockDevices } from '@/test/mocks/devices'

const iconMap = { desktop: Monitor, mobile: Smartphone, tablet: Tablet }

/** Device management page for viewing, trusting, and revoking authorized devices. */
export function DevicesPage() {
  const [devices, setDevices] = useState(mockDevices)

  const revokeDevice = (id: string) => setDevices(devices.filter((d) => d.id !== id))
  const revokeAll = () => setDevices(devices.filter((d) => d.isCurrent))
  const toggleTrust = (id: string) =>
    setDevices(devices.map((d) => (d.id === id ? { ...d, isTrusted: !d.isTrusted } : d)))

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border/60 flex h-[60px] items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <Shield className="text-primary h-5 w-5" strokeWidth={1.75} />
          <div>
            <h2 className="text-[15px] font-semibold">Devices</h2>
            <p className="text-muted-foreground/60 text-[11px]">
              Manage devices with access to your vault
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg text-[13px]"
          onClick={revokeAll}
          disabled={devices.length <= 1}
        >
          <XCircle className="h-3.5 w-3.5" /> Revoke all
        </Button>
      </div>

      <div className="border-border/60 grid grid-cols-3 gap-4 border-b px-6 py-4">
        <div className="border-border/60 rounded-xl border p-4">
          <p className="text-muted-foreground/50 text-[11px] font-medium tracking-wide uppercase">
            Active devices
          </p>
          <p className="mt-1 text-2xl font-semibold">{devices.length}</p>
        </div>
        <div className="border-border/60 rounded-xl border p-4">
          <p className="text-muted-foreground/50 text-[11px] font-medium tracking-wide uppercase">
            Trusted
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-500">
            {devices.filter((d) => d.isTrusted).length}
          </p>
        </div>
        <div className="border-border/60 rounded-xl border p-4">
          <p className="text-muted-foreground/50 text-[11px] font-medium tracking-wide uppercase">
            This session
          </p>
          <p className="text-primary mt-1 text-2xl font-semibold">1</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-2">
          {devices.map((device) => {
            const Icon = iconMap[device.type]
            return (
              <div
                key={device.id}
                className={cn(
                  'group flex items-center gap-4 rounded-xl border px-5 py-4 transition-all duration-150',
                  device.isCurrent
                    ? 'border-primary/20 bg-primary/[0.03]'
                    : 'border-border/60 hover:border-border hover:bg-accent/30'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    device.isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{device.name}</p>
                    {device.isCurrent && (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        Current
                      </span>
                    )}
                    {device.isTrusted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  </div>
                  <div className="text-muted-foreground/60 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    <span>{device.os}</span>
                    <span>•</span>
                    <span>{device.browser}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {device.location}
                    </span>
                    <span>•</span>
                    <span>{device.ip}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-muted-foreground/60 flex items-center justify-end gap-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      {device.lastActive}
                    </p>
                  </div>
                  {!device.isCurrent && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:bg-accent h-8 rounded-lg text-[12px]"
                        onClick={() => toggleTrust(device.id)}
                      >
                        {device.isTrusted ? 'Untrust' : 'Trust'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 rounded-lg"
                        onClick={() => revokeDevice(device.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
