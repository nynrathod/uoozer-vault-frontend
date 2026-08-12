import { useEffect } from 'react'
import { Router } from './router'
import { useAuthStore } from '@stores/authStore'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from '@app/providers/ErrorBoundary'

function App() {
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isInitializing) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  )
}

export default App
