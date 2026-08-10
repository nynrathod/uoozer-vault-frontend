// src/App.tsx
import { useEffect } from 'react'
import { Router } from './router'
import { useAuthStore } from '@stores/authStore'
import { Loader2 } from 'lucide-react'
import {
  ChunkStreamLoader,
  OrbitCoreLoader,
  PulseGridLoader,
  VaultLoader,
} from './components/ui/VaultLoader'

function App() {
  const isInitializing = useAuthStore((s) => s.isInitializing)
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  // Only show full-screen loader if we are actively validating a token.
  // If the user is not logged in, isInitializing is false, so we instantly render Login.
  if (isInitializing) {
    return (
      <div className="bg-background flex h-screen w-screen items-center justify-center">
        {/* <VaultLoader className="text-primary h-8 w-8 animate-spin" /> */}
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        {/* <ChunkStreamLoader size={40} /> */}
        {/* <OrbitCoreLoader size={40} /> */}
        {/* <PulseGridLoader size={40} /> */}
      </div>
    )
  }

  return <Router />
}

export default App
