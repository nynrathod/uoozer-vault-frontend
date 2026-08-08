import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@stores/authStore'
import { ROUTES } from '@lib/constants'

// Layouts
import { AppLayout } from '@components/layout/AppLayout'
import { AuthLayout } from '@components/layout/AuthLayout'

// Pages
import { LoginPage } from '@pages/auth/LoginPage'
import { SignupPage } from '@pages/auth/SignupPage'
import { VaultPage } from '@pages/vault/VaultPage'
import { NotesPage } from '@pages/notes/NotesPage'

import { DevicesPage } from '@/pages/devices/DevicesPage'
import { AuditLogsPage } from '@/pages/audit/AuditLogsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />
}

function PublicRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return !isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.VAULT} replace />
}

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.SIGNUP, element: <SignupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.VAULT, element: <VaultPage /> },
          { path: ROUTES.VAULT_FOLDER, element: <VaultPage /> },
          { path: ROUTES.NOTES, element: <NotesPage /> },
          { path: ROUTES.SETTINGS, element: <SettingsPage /> },
          { path: ROUTES.DEVICES, element: <DevicesPage /> },
          { path: ROUTES.AUDIT_LOGS, element: <AuditLogsPage /> },

          { path: '/', element: <Navigate to={ROUTES.VAULT} replace /> },
        ],
      },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
