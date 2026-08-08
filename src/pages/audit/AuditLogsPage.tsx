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
import { Separator } from '@ui/Separator'

type LogAction =
  'upload' | 'download' | 'delete' | 'share' | 'login' | 'logout' | 'edit' | 'preview'

interface AuditLog {
  id: string
  action: LogAction
  target: string
  targetType: 'file' | 'folder' | 'account'
  user: string
  ip: string
  location: string
  timestamp: string
  status: 'success' | 'warning' | 'error'
}

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

const mockLogs: AuditLog[] = [
  {
    id: '1',
    action: 'login',
    target: 'Chrome on macOS',
    targetType: 'account',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date().toISOString(),
    status: 'success',
  },
  {
    id: '2',
    action: 'upload',
    target: 'Annual Report.pdf',
    targetType: 'file',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    action: 'share',
    target: 'Work Projects',
    targetType: 'folder',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    action: 'download',
    target: 'Vacation.png',
    targetType: 'file',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: 'success',
  },
  {
    id: '5',
    action: 'delete',
    target: 'old_backup.zip',
    targetType: 'file',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: 'warning',
  },
  {
    id: '6',
    action: 'login',
    target: 'Safari on iOS',
    targetType: 'account',
    user: 'nayan@example.com',
    ip: '49.36.112.88',
    location: 'Pune, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    status: 'success',
  },
  {
    id: '7',
    action: 'edit',
    target: 'Meeting Notes.docx',
    targetType: 'file',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    status: 'success',
  },
  {
    id: '8',
    action: 'preview',
    target: 'Budget.xlsx',
    targetType: 'file',
    user: 'nayan@example.com',
    ip: '103.21.45.120',
    location: 'Mumbai, IN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    status: 'success',
  },
]

export function AuditLogsPage() {
  const [filter, setFilter] = useState<LogAction | 'all'>('all')
  const [logs] = useState<AuditLog[]>(mockLogs)

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.action === filter)

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Header */}
      <div className="border-border/60 flex h-[60px] items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <Activity className="text-primary h-5 w-5" strokeWidth={1.8} />
          <div>
            <h2 className="text-[15px] font-semibold">Audit Logs</h2>
            <p className="text-muted-foreground/60 text-[11px]">Track all activity in your vault</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button className="border-border/60 bg-background hover:bg-accent flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors">
              <Filter className="text-muted-foreground/60 h-3.5 w-3.5" />
              <span className="capitalize">{filter === 'all' ? 'All activity' : filter}</span>
              <ChevronDown className="text-muted-foreground/60 h-3.5 w-3.5" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[13px]">
            <Calendar className="h-3.5 w-3.5" />
            Last 30 days
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="border-border/60 grid grid-cols-4 gap-4 border-b px-6 py-4">
        {[
          { label: 'Total events', value: logs.length },
          { label: 'Uploads', value: logs.filter((l) => l.action === 'upload').length },
          { label: 'Downloads', value: logs.filter((l) => l.action === 'download').length },
          { label: 'Logins', value: logs.filter((l) => l.action === 'login').length },
        ].map((stat) => (
          <div key={stat.label} className="border-border/60 rounded-xl border p-4">
            <p className="text-muted-foreground/50 text-[11px] font-medium tracking-wide uppercase">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border-border/60 rounded-xl border">
          {/* Table header */}
          <div className="border-border/60 text-muted-foreground/50 flex items-center gap-3 border-b px-5 py-3 text-[11px] font-semibold tracking-wide uppercase">
            <div className="w-8" />
            <div className="w-32">Action</div>
            <div className="min-w-0 flex-1">Target</div>
            <div className="hidden w-32 md:block">Location</div>
            <div className="hidden w-28 lg:block">IP Address</div>
            <div className="w-28 text-right">Time</div>
          </div>

          {/* Rows */}
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
