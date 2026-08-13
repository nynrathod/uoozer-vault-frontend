export interface MockDevice {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  os: string
  browser: string
  location: string
  ip: string
  lastActive: string
  isCurrent: boolean
  isTrusted: boolean
}
export const mockDevices: MockDevice[] = [
  {
    id: '1',
    name: 'MacBook Pro',
    type: 'desktop',
    os: 'macOS Sonoma 14.5',
    browser: 'Chrome 126',
    location: 'Mumbai, India',
    ip: '103.21.45.***',
    lastActive: 'Active now',
    isCurrent: true,
    isTrusted: true,
  },
  {
    id: '2',
    name: 'iPhone 15 Pro',
    type: 'mobile',
    os: 'iOS 17.5',
    browser: 'Safari',
    location: 'Mumbai, India',
    ip: '103.21.45.***',
    lastActive: '2 hours ago',
    isCurrent: false,
    isTrusted: true,
  },
  {
    id: '3',
    name: 'Windows PC',
    type: 'desktop',
    os: 'Windows 11',
    browser: 'Edge 125',
    location: 'Pune, India',
    ip: '49.36.112.***',
    lastActive: '3 days ago',
    isCurrent: false,
    isTrusted: false,
  },
  {
    id: '4',
    name: 'iPad Air',
    type: 'tablet',
    os: 'iPadOS 17',
    browser: 'Safari',
    location: 'Delhi, India',
    ip: '182.64.89.***',
    lastActive: '1 week ago',
    isCurrent: false,
    isTrusted: true,
  },
]
