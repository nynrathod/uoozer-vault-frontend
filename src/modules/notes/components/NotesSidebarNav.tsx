import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Hash, Plus, Star, StickyNote, Trash2 } from 'lucide-react'
import { Pin } from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { noteCounts } from '../document'
import { useNotesStore } from '../store/notesStore'

/**
 * Notes section nav — the Notes app's own sidebar section
 * ("Section · the app's own nav — Pinned and the page tree for Notes").
 *
 * Shell metrics (same as Sidebar rows): 30 high · radius 6 · padding 0 8 ·
 * gap 10 · 13.5/30 · 500 · active = Active fill + ink label + blue icon ·
 * rest = #4B5563 + ghost icon · section label 12/16 · 500 muted.
 * Everything flows from index.css tokens — nothing hardcoded.
 */

const links = [
  { label: 'All Notes', icon: StickyNote, path: ROUTES.NOTES, count: 'all' as const },
  { label: 'Starred', icon: Star, path: ROUTES.NOTES_STARRED, count: 'starred' as const },
  { label: 'Pinned', icon: Pin, path: ROUTES.NOTES_PINNED, count: 'pinned' as const },
  { label: 'Trash', icon: Trash2, path: ROUTES.NOTES_TRASH, count: 'trash' as const },
]

export function NotesSidebarNav({ open }: { open: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const notes = useNotesStore((state) => state.notes)
  const tagFilter = useNotesStore((state) => state.tagFilter)
  const setTagFilter = useNotesStore((state) => state.setTagFilter)
  const counts = noteCounts(notes)

  const create = () => {
    useNotesStore.getState().createNote()
    navigate(ROUTES.NOTES)
  }

  const rowClass = (isActive: boolean) =>
    cn(
      'focus-visible:outline-ring flex h-[30px] items-center gap-2.5 rounded-sm text-[13.5px] leading-[30px] font-medium outline outline-offset-2 outline-2 outline-transparent transition-colors duration-[120ms]',
      open ? 'px-2' : 'justify-center px-0',
      isActive
        ? 'bg-active-surface text-ink [&>svg]:text-primary'
        : 'text-gray-strong hover:bg-hover-surface [&>svg]:text-ghost'
    )

  return (
    <div className="mt-4">
      {/* New note — soft button per the Components sheet */}
      <button
        type="button"
        title="New note (⌘N)"
        onClick={create}
        className={cn(
          'focus-visible:outline-ring bg-tint text-blue-ink hover:bg-selection active:bg-tint flex items-center rounded-sm text-[13.5px] font-medium outline outline-offset-2 outline-2 outline-transparent transition-colors duration-[120ms]',
          open
            ? 'mb-1 h-[30px] w-full justify-center gap-2 px-2'
            : 'mx-auto mb-1 flex h-[30px] w-[30px] justify-center'
        )}
      >
        <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
        {open && 'New note'}
      </button>

      {open && (
        <p className="text-muted-foreground mt-3 mb-1.5 px-2 text-[12px] leading-4 font-medium">
          Notes
        </p>
      )}
      <nav className="space-y-px">
        {links.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.NOTES}
            title={item.label}
            onClick={() => setTagFilter(null)}
            className={({ isActive }) => rowClass(isActive && !(item.path === ROUTES.NOTES && tagFilter))}
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
            {open && (
              <>
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground ml-auto text-[11.5px] tabular-nums">
                  {counts[item.count]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {open && counts.tags.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-1.5 px-2 text-[12px] leading-4 font-medium">
            Tags
          </p>
          <nav className="space-y-px">
            {counts.tags.map((tag) => {
              const active = tagFilter === tag.name && pathname === ROUTES.NOTES
              return (
                <button
                  key={tag.name}
                  type="button"
                  title={`#${tag.name}`}
                  onClick={() => {
                    setTagFilter(tag.name)
                    if (pathname !== ROUTES.NOTES) navigate(ROUTES.NOTES)
                  }}
                  className={cn(
                    'focus-visible:outline-ring flex h-[30px] w-full items-center gap-2.5 rounded-sm px-2 text-left text-[13.5px] leading-[30px] font-medium outline outline-offset-2 outline-2 outline-transparent transition-colors duration-[120ms]',
                    active
                      ? 'bg-active-surface text-ink [&>svg]:text-primary'
                      : 'text-gray-strong hover:bg-hover-surface [&>svg]:text-ghost'
                  )}
                >
                  <Hash className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{tag.name}</span>
                  <span className="text-muted-foreground ml-auto text-[11.5px] tabular-nums">
                    {tag.count}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
