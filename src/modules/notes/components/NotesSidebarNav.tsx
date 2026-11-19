import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Hash, Plus, Star, StickyNote, Trash2 } from 'lucide-react'
import { Pin } from 'lucide-react'
import { cn } from '@lib/utils'
import { ROUTES } from '@lib/constants'
import { noteCounts } from '../document'
import { useNotesStore } from '../store/notesStore'

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

  return (
    <div className="mb-5">
      <button
        type="button"
        title="New note"
        onClick={create}
        className={cn(
          'bg-primary text-primary-foreground shadow-sm transition-all duration-150 hover:shadow-md active:scale-[0.98]',
          open
            ? 'mb-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-semibold'
            : 'mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg'
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        {open && 'New note'}
      </button>

      <nav className="space-y-0.5">
        {links.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.NOTES}
            title={item.label}
            onClick={() => setTagFilter(null)}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center rounded-lg text-[13px] font-medium transition-colors duration-150',
                open ? 'gap-3 px-3' : 'justify-center px-2',
                isActive && !(item.path === ROUTES.NOTES && tagFilter)
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {open && (
              <>
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
                  {counts[item.count]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {open && counts.tags.length > 0 && (
        <div className="mt-4">
          <p className="text-sidebar-foreground/40 mb-1 px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase">
            Tags
          </p>
          <nav className="space-y-0.5">
            {counts.tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                title={`#${tag.name}`}
                onClick={() => {
                  setTagFilter(tag.name)
                  if (pathname !== ROUTES.NOTES) navigate(ROUTES.NOTES)
                }}
                className={cn(
                  'flex h-8 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium transition-colors duration-150',
                  tagFilter === tag.name && pathname === ROUTES.NOTES
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                <Hash className="mr-3 h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{tag.name}</span>
                <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
                  {tag.count}
                </span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
