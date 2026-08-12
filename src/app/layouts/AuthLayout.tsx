import { Outlet } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { APP_CONFIG } from '@config/app'

export function AuthLayout() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl">
          <Shield className="h-5 w-5" />
        </div>
        <span className="text-xl font-semibold tracking-tight">{APP_CONFIG.name}</span>
      </div>
      <div className="w-full max-w-[420px]">
        <Outlet />
      </div>
    </div>
  )
}
