import { useEffect, useState } from 'react'
import { FolderInput } from 'lucide-react'
import { useFileStore } from '@stores/fileStore'
import { cn } from '@lib/utils'

export function DropHintBar() {
  const dropHint = useFileStore((s) => s.dropHint)
  const has = !!dropHint

  const [mounted, setMounted] = useState(has)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (has) {
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(t)
  }, [has])

  useEffect(() => {
    const clear = () => useFileStore.getState().setDropHint(null)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  if (!mounted || !dropHint) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
        'transition-all duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      )}
    >
      <div className="flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-medium text-white shadow-2xl shadow-black/30 dark:bg-zinc-800">
        <FolderInput className="text-primary h-4 w-4 shrink-0" />
        <span>
          Drop to move to{' '}
          <span className="font-semibold">
            {dropHint.destinationId === null ? 'Vault' : `“${dropHint.destinationName}”`}
          </span>
        </span>
      </div>
    </div>
  )
}
