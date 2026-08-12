import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { useIsMobile } from '@hooks/useMediaQuery'

export function AppLayout() {
  const isMobile = useIsMobile()

  return (
    <div className="bg-background text-foreground flex h-screen w-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        {isMobile && <MobileNav />}
      </div>
    </div>
  )
}
