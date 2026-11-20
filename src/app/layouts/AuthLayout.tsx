import { Outlet } from 'react-router-dom'

/** Centered layout wrapper for authentication pages. */
export function AuthLayout() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-105">
        <Outlet />
      </div>
    </div>
  )
}
