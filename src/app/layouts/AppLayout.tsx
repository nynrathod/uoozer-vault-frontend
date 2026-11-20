import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { usePreviewStore } from '@stores/previewStore'
import { useFileStore } from '@stores/fileStore'
import { useGlobalShortcuts } from '@hooks/useGlobalShortcuts'
import { ShortcutsDialog } from '@/components/ui/overlays/ShortcutsDialog'

/** Root layout shell with sidebar, header, and routed content. */
export function AppLayout() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const closePreview = usePreviewStore((s) => s.close)

  const currentFolderId = useFileStore((s) => s.currentFolderId)

  // ⌘K search · ⌘/ shortcuts · ⌘⇧L lock — mounted once for the whole app.
  useGlobalShortcuts()

  useEffect(() => {
    closePreview()
  }, [location.pathname, currentFolderId, closePreview])

  return (
    <div className="bg-background text-ink flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        {/* {isMobile && <MobileNav />} */}
      </div>
      <ShortcutsDialog />
    </div>
  )
}
