import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@stores/authStore'
import { ROUTES } from '@lib/constants'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { VaultLoader } from '@/components/ui/feedback/VaultLoader'

const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
)
const SignupPage = lazy(() =>
  import('@/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage }))
)
const RecoveryPage = lazy(() =>
  import('@/pages/auth/RecoveryPage').then((m) => ({ default: m.RecoveryPage }))
)
const VaultPage = lazy(() =>
  import('@/pages/vault/VaultPage').then((m) => ({ default: m.VaultPage }))
)
const NotesPage = lazy(() =>
  import('@/pages/notes/NotesPage').then((m) => ({ default: m.NotesPage }))
)
const DevicesPage = lazy(() =>
  import('@/pages/devices/DevicesPage').then((m) => ({ default: m.DevicesPage }))
)
const AuditLogsPage = lazy(() =>
  import('@/pages/audit/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)

/** Route guard: redirects unauthenticated users to the login page. */
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />
}

/** Route guard: redirects already-authenticated users away from public pages (login/signup). */
function PublicRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return !isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.VAULT} replace />
}

/** Loading spinner shown while lazy-loaded route components are being fetched. */
const SuspenseFallback = () => (
  <div className="flex h-full w-full items-center justify-center">
    <VaultLoader size={48} />
  </div>
)

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: ROUTES.LOGIN,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <LoginPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.SIGNUP,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <SignupPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.RECOVERY,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <RecoveryPage />
              </Suspense>
            ),
          },
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
          {
            path: ROUTES.VAULT,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.VAULT_STARRED,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.VAULT_PRIVATE,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.VAULT_TRASH,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.VAULT_FOLDER,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.NOTES,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <NotesPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.NOTES_PINNED,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <NotesPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.NOTES_TRASH,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <NotesPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.SETTINGS,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.DEVICES,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <DevicesPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.AUDIT_LOGS,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <AuditLogsPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.PASSWORDS,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.PASSWORDS_FAVORITES,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          {
            path: ROUTES.PASSWORDS_TRASH,
            element: (
              <Suspense fallback={<SuspenseFallback />}>
                <VaultPage />
              </Suspense>
            ),
          },
          { path: '/', element: <Navigate to={ROUTES.VAULT} replace /> },
        ],
      },
    ],
  },
])

/** Application router component wrapping the React Router provider. */
export function Router() {
  return <RouterProvider router={router} />
}
