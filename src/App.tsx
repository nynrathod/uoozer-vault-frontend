import { useEffect } from 'react'
import { Router } from './router'
import { useAuthStore } from '@stores/authStore'
import { useCryptoStore } from '@stores/cryptoStore'
import ErrorBoundary from '@app/providers/ErrorBoundary'
import { VaultLoader } from './components/ui/feedback/VaultLoader'

function App() {
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const initialize = useAuthStore((s) => s.initialize)
  const initializeCrypto = useCryptoStore((s) => s.initialize)

  useEffect(() => {
    initializeCrypto()
    initialize()
  }, [initialize, initializeCrypto])

  if (isInitializing) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        <VaultLoader size={48} />
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
