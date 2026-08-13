import { useState, useEffect, useRef } from 'react'

/** Options for the useKeyboardNavigation hook. */
interface KeyboardNavigationOptions<T> {
  items: T[]
  onSelect: (item: T) => void
  open: boolean
  setOpen: (open: boolean) => void
}

/** Arrow-key and Enter navigation over a list of items with auto-scroll into view. */
export function useKeyboardNavigation<T>({
  items,
  onSelect,
  open,
  setOpen,
}: KeyboardNavigationOptions<T>) {
  const [activeIndex, setActiveIndex] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setActiveIndex(0)
  }, [open])

  useEffect(() => {
    const activeItem = itemRefs.current[activeIndex]
    if (activeItem && listRef.current) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length > 0) {
        setActiveIndex((prev) => (prev + 1) % items.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length > 0) {
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[activeIndex]) {
        onSelect(items[activeIndex])
      }
    }
  }

  return { activeIndex, setActiveIndex, itemRefs, listRef, handleKeyDown }
}
