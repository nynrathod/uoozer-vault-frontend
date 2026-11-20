import { Outlet } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { APP_CONFIG } from '@config/app'

/** Centered layout wrapper for authentication pages. */
export function AuthLayout() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <Outlet />
      </div>
    </div>
  )
}
