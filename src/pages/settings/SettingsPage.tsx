import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  User,
  Shield,
  Bell,
  Palette,
  Camera,
  Mail,
  Smartphone,
  KeyRound,
  Fingerprint,
  Save,
  Check,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
} from 'lucide-react'

import { cn } from '@lib/utils'
import { Button } from '@ui/Button'
import { Separator } from '@ui/Separator'
import { ScrollArea } from '@ui/ScrollArea'
import { Input } from '@ui/Input'

import { useTheme } from '@hooks/useTheme'
import { useAuthStore } from '@stores/authStore'

const tabs = [
  { id: 'general', label: 'General', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
]

const THEMES = [
  { id: 'default' as const, label: 'Uoozer Blue', color: '#0061FE' },
  { id: 'uoozer' as const, label: 'Uoozer Amber', color: '#F5A623' },
  { id: 'obsidian' as const, label: 'Obsidian Dark', color: '#4F8CFF' },
  { id: 'slate' as const, label: 'Slate Gray', color: '#4A5568' },
  { id: 'forest' as const, label: 'Forest Green', color: '#2F855A' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  const { variant, scheme, setVariant, setScheme } = useTheme()
  const user = useAuthStore((s) => s.user)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Top header */}
      <div className="border-border/60 flex h-[60px] items-center border-b px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="mr-3 h-8 w-8 rounded-lg lg:hidden"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-[15px] font-semibold">Settings</h2>
      </div>

      {/* Tab navigation */}
      <div className="no-scrollbar border-border/60 flex items-center gap-1 border-b px-4 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
              activeTab === tab.id
                ? 'bg-primary/[0.06] text-primary'
                : 'text-foreground/70 hover:bg-accent/50'
            )}
          >
            <tab.icon className="h-4 w-4" strokeWidth={1.8} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
          {activeTab === 'general' && <GeneralTab user={user} onSave={handleSave} saved={saved} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'notifications' && <NotificationsTab onSave={handleSave} saved={saved} />}
          {activeTab === 'appearance' && (
            <AppearanceTab
              variant={variant}
              scheme={scheme}
              setVariant={setVariant}
              setScheme={setScheme}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// --- General Tab ---
function GeneralTab({ user, onSave, saved }: any) {
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
          <Camera className="h-4 w-4" />
          Change Avatar
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
        <Button onClick={onSave} className="gap-1.5 rounded-lg">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// --- Security Tab ---
function SecurityTab() {
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

// --- Notifications Tab ---
function NotificationsTab({ onSave, saved }: any) {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [productUpdates, setProductUpdates] = useState(false)
  const [securityAlerts, setSecurityAlerts] = useState(true)

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
        <Button onClick={onSave} className="gap-1.5 rounded-lg">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

// --- Appearance Tab ---
function AppearanceTab({ variant, scheme, setVariant, setScheme }: any) {
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

// Helper Component for Toggle Row
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
