import { useState } from 'react'
import {
  Activity,
  Upload,
  Download,
  Trash2,
  Share2,
  LogIn,
  LogOut,
  Edit3,
  Eye,
  Filter,
  Calendar,
  ChevronDown,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@lib/utils'
import { Button } from '@ui/Button'
import { mockLogs, type LogAction } from '@/test/mocks/auditLogs'
import { PageHeader, StatCard } from '@/components/ui'

const actionConfig: Record<LogAction, { icon: React.ElementType; label: string; color: string }> = {
  upload: { icon: Upload, label: 'Uploaded', color: 'text-emerald-500 bg-emerald-500/10' },
  download: { icon: Download, label: 'Downloaded', color: 'text-blue-500 bg-blue-500/10' },
  delete: { icon: Trash2, label: 'Deleted', color: 'text-destructive bg-destructive/10' },
  share: { icon: Share2, label: 'Shared', color: 'text-purple-500 bg-purple-500/10' },
  login: { icon: LogIn, label: 'Signed in', color: 'text-primary bg-primary/10' },
  logout: { icon: LogOut, label: 'Signed out', color: 'text-muted-foreground bg-muted/80' },
  edit: { icon: Edit3, label: 'Modified', color: 'text-amber-500 bg-amber-500/10' },
  preview: { icon: Eye, label: 'Previewed', color: 'text-cyan-500 bg-cyan-500/10' },
}

/** Audit log viewer page with stats summary and filterable event table. */
export function AuditLogsPage() {
  const [filter] = useState<LogAction | 'all'>('all')
  const [logs] = useState(mockLogs)

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.action === filter)

  return (
    <div className="bg-background flex h-full flex-col">
      <PageHeader title="Audit Logs" subtitle="Track all activity in your vault" icon={Activity}>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="border-border/60 bg-background hover:bg-accent flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors">
              <Filter className="text-muted-foreground/60 h-3.5 w-3.5" />
              <span className="capitalize">{filter === 'all' ? 'All activity' : filter}</span>
              <ChevronDown className="text-muted-foreground/60 h-3.5 w-3.5" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]">
            <Calendar className="h-3.5 w-3.5" /> Last 30 days
          </Button>
        </div>
      </PageHeader>

      <div className="border-border/60 grid grid-cols-4 gap-4 border-b px-6 py-4">
        <StatCard label="Total events" value={logs.length} />
        <StatCard label="Uploads" value={logs.filter((l) => l.action === 'upload').length} />
        <StatCard label="Downloads" value={logs.filter((l) => l.action === 'download').length} />
        <StatCard label="Logins" value={logs.filter((l) => l.action === 'login').length} />
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border-border/60 rounded-xl border">
          <div className="border-border/60 text-muted-foreground/50 flex items-center gap-3 border-b px-5 py-3 text-[11px] font-semibold tracking-wide uppercase">
            <div className="w-8" />
            <div className="w-32">Action</div>
            <div className="min-w-0 flex-1">Target</div>
            <div className="hidden w-32 md:block">Location</div>
            <div className="hidden w-28 lg:block">IP Address</div>
            <div className="w-28 text-right">Time</div>
          </div>
          {filtered.map((log) => {
            const config = actionConfig[log.action]
            const Icon = config.icon
            return (
              <div
                key={log.id}
                className="group border-border/40 hover:bg-accent/30 flex items-center gap-3 border-b px-5 py-3 transition-colors last:border-b-0"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    config.color
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="w-32">
                  <span className="text-[13px] font-medium">{config.label}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{log.target}</p>
                  <p className="text-muted-foreground/60 text-[11px]">
                    {log.targetType} • {log.user}
                  </p>
                </div>
                <div className="hidden w-32 md:block">
                  <p className="text-muted-foreground/70 text-[13px]">{log.location}</p>
                </div>
                <div className="hidden w-28 lg:block">
                  <p className="text-muted-foreground/70 font-mono text-[12px]">{log.ip}</p>
                </div>
                <div className="w-28 text-right">
                  <p className="text-muted-foreground/70 text-[12px]">
                    {formatRelativeDate(log.timestamp)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
