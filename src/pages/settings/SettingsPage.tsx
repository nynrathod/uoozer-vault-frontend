import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Shield, Bell, Palette, ChevronLeft } from 'lucide-react'
import { cn } from '@lib/utils'
import { Button } from '@ui/Button'
import { ScrollArea } from '@ui/ScrollArea'
import { Tabs, TabsList, TabsTrigger, PageHeader } from '@/components/ui'
import { useTheme } from '@hooks/useTheme'
import { ProfileSection } from './ProfileSection'
import { SecuritySection } from './SecuritySection'
import { AppearanceSection } from './AppearanceSection'
import { NotificationsSection } from './NotificationsSection'

const tabs = [
  { id: 'general', label: 'General', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
]

/** Settings page with tabbed navigation between profile, security, notifications, and appearance. */
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general')
  const { variant, scheme, setVariant, setScheme } = useTheme()

  const navigate = useNavigate()

  return (
    <div className="bg-background flex h-full flex-col">
      <PageHeader title="Settings">
        <Button
          variant="ghost"
          size="icon-sm"
          className="mr-3 h-8 w-8 rounded-lg lg:hidden"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
        <div className="no-scrollbar border-border/60 flex items-center gap-1 border-b px-4 py-2">
          <TabsList className="h-auto bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                  'data-[state=active]:bg-primary/[0.06] data-[state=active]:text-primary',
                  'data-[state=inactive]:text-foreground/70 data-[state=inactive]:hover:bg-accent/50'
                )}
              >
                <tab.icon className="h-4 w-4" strokeWidth={1.75} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl px-4 py-6 lg:px-8 lg:py-8">
            {activeTab === 'general' && <ProfileSection />}
            {activeTab === 'security' && <SecuritySection />}
            {activeTab === 'notifications' && <NotificationsSection />}
            {activeTab === 'appearance' && (
              <AppearanceSection
                variant={variant}
                scheme={scheme}
                setVariant={setVariant}
                setScheme={setScheme}
              />
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
