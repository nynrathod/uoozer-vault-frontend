export type LogAction =
  'upload' | 'download' | 'delete' | 'share' | 'login' | 'logout' | 'edit' | 'preview'
export interface MockAuditLog {
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

export const mockLogs: MockAuditLog[] = [
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
]
