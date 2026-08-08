import { useState } from 'react'
import { cn } from '@lib/utils'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { ScrollArea } from '@ui/ScrollArea'
import { Separator } from '@ui/Separator'
import {
  Plus,
  Search,
  Trash2,
  Clock,
  StickyNote,
  ChevronLeft,
  Save,
  Bold,
  Italic,
  List,
  Heading1,
} from 'lucide-react'

interface Note {
  id: string
  title: string
  content: string
  updatedAt: string
  encrypted: boolean
}

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Project Ideas',
    content: 'End-to-end encrypted notes for all your sensitive thoughts...',
    updatedAt: new Date().toISOString(),
    encrypted: true,
  },
  {
    id: '2',
    title: 'Meeting Notes',
    content: 'Q3 planning session with the team...',
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    encrypted: true,
  },
]

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(mockNotes)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const selectedNote = notes.find((n) => n.id === selectedNoteId)
  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createNote = () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      updatedAt: new Date().toISOString(),
      encrypted: true,
    }
    setNotes([newNote, ...notes])
    setSelectedNoteId(newNote.id)
    setIsEditing(true)
  }

  const deleteNote = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id))
    if (selectedNoteId === id) {
      setSelectedNoteId(null)
      setIsEditing(false)
    }
  }

  return (
    <div className="bg-background flex h-full">
      {/* Sidebar */}
      <div
        className={cn(
          'border-border/60 bg-card flex w-80 flex-col border-r',
          selectedNoteId && 'hidden lg:flex'
        )}
      >
        <div className="border-border/60 flex h-[60px] items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <StickyNote className="text-primary h-5 w-5" strokeWidth={1.8} />
            <h2 className="text-[15px] font-semibold">Notes</h2>
          </div>
          <Button size="icon-sm" onClick={createNote} className="h-8 w-8 rounded-lg">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="text-muted-foreground/50 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search notes..."
              className="border-border/60 bg-secondary/50 placeholder:text-muted-foreground/50 focus-visible:bg-background h-9 rounded-lg pl-9 text-[13px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNoteId(note.id)
                  setIsEditing(false)
                }}
                className={cn(
                  'group flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors duration-150',
                  selectedNoteId === note.id
                    ? 'bg-primary/[0.06] text-primary'
                    : 'hover:bg-accent/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-medium">{note.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    className="hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-muted-foreground/60 line-clamp-2 text-[12px] leading-relaxed">
                  {note.content}
                </p>
                <div className="text-muted-foreground/50 flex items-center gap-1 text-[11px]">
                  <Clock className="h-3 w-3" />
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className={cn('flex flex-1 flex-col', !selectedNoteId && 'hidden lg:flex')}>
        {selectedNote ? (
          <>
            <div className="border-border/60 flex h-[60px] items-center justify-between border-b px-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-lg lg:hidden"
                  onClick={() => setSelectedNoteId(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  value={selectedNote.title}
                  onChange={(e) => {
                    setNotes(
                      notes.map((n) =>
                        n.id === selectedNote.id ? { ...n, title: e.target.value } : n
                      )
                    )
                  }}
                  className="border-0 bg-transparent px-0 text-lg font-semibold focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-accent h-8 w-8 rounded-lg"
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="mx-1 h-5" />
                <Button size="sm" className="h-8 gap-1.5 rounded-lg px-3 text-[13px]">
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </div>

            <div className="flex-1 p-6">
              <textarea
                value={selectedNote.content}
                onChange={(e) => {
                  setNotes(
                    notes.map((n) =>
                      n.id === selectedNote.id
                        ? { ...n, content: e.target.value, updatedAt: new Date().toISOString() }
                        : n
                    )
                  )
                }}
                placeholder="Start typing your encrypted note..."
                className="text-foreground placeholder:text-muted-foreground/40 h-full w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
              />
            </div>

            <div className="border-border/60 text-muted-foreground/60 flex items-center justify-between border-t px-4 py-2.5 text-[11px]">
              <span>{selectedNote.content.length} characters</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                End-to-end encrypted
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="bg-secondary/80 text-muted-foreground/60 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
              <StickyNote className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <h3 className="text-foreground text-[15px] font-semibold">Select a note</h3>
            <p className="text-muted-foreground/70 mt-1.5 max-w-xs text-[13px] leading-relaxed">
              Choose a note from the sidebar or create a new one to get started
            </p>
            <Button onClick={createNote} className="mt-6 gap-2 rounded-lg px-4">
              <Plus className="h-4 w-4" />
              New note
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
