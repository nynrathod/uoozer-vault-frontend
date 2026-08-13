import { useState } from 'react'
import { Dialog, DialogTitle, DialogDescription } from '@ui/Dialog'
import { Button } from '@ui/Button'
import { Copy, Check, Globe, Lock, Mail, X, ChevronDown, Link2 } from 'lucide-react'
import { cn } from '@lib/utils'
import { DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from '@ui/DropdownMenu'
import { useClipboard } from '@hooks/useClipboard'
import { mockDirectory } from '@/test/mocks/users'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  isFolder: boolean
  itemCount?: number
}

type Suggestion =
  { type: 'user'; data: (typeof mockDirectory)[0] } | { type: 'email'; data: { email: string } }

export function ShareDialog({
  open,
  onOpenChange,
  itemName,
  isFolder,
  itemCount = 0,
}: ShareDialogProps) {
  const { copied, copy } = useClipboard()
  const [accessType, setAccessType] = useState<'invited' | 'public'>('invited')
  const [inputValue, setInputValue] = useState('')
  const [invitedUsers, setInvitedUsers] = useState<typeof mockDirectory>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const shareLink = `https://uoozer.app/s/${itemName.toLowerCase().replace(/\s+/g, '-')}`

  const filteredUsers = mockDirectory.filter(
    (user) =>
      !invitedUsers.some((inv) => inv.id === user.id) &&
      (user.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        user.email.toLowerCase().includes(inputValue.toLowerCase()))
  )

  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email)
  const suggestions: Suggestion[] = []
  if (filteredUsers.length > 0)
    filteredUsers.slice(0, 4).forEach((u) => suggestions.push({ type: 'user', data: u }))
  if (isValidEmail(inputValue) && !mockDirectory.some((u) => u.email === inputValue))
    suggestions.push({ type: 'email', data: { email: inputValue } })

  const addUser = (user: (typeof mockDirectory)[0]) => {
    if (invitedUsers.some((inv) => inv.email === user.email)) return
    setInvitedUsers([...invitedUsers, user])
    setInputValue('')
    setShowAutocomplete(false)
    setActiveIndex(-1)
  }

  const removeUser = (id: string) => setInvitedUsers(invitedUsers.filter((u) => u.id !== id))

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    if (suggestion.type === 'user') addUser(suggestion.data)
    else
      addUser({
        id: crypto.randomUUID(),
        name: suggestion.data.email,
        email: suggestion.data.email,
      })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && inputValue === '' && invitedUsers.length > 0) {
      removeUser(invitedUsers[invitedUsers.length - 1].id)
      return
    }
    if (!showAutocomplete || suggestions.length === 0) {
      if (e.key === 'Enter' && isValidEmail(inputValue)) {
        e.preventDefault()
        addUser({ id: crypto.randomUUID(), name: inputValue, email: inputValue })
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < suggestions.length)
        handleSelectSuggestion(suggestions[activeIndex])
      else if (suggestions.length === 1) handleSelectSuggestion(suggestions[0])
      else if (isValidEmail(inputValue))
        addUser({ id: crypto.randomUUID(), name: inputValue, email: inputValue })
    }
  }

  const ActiveAccessIcon = accessType === 'invited' ? Lock : Globe

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="w-full p-0 sm:max-w-[480px]">
      <div className="flex flex-col">
        <div className="p-5 pb-0">
          <div className="mb-4 flex flex-col gap-1">
            <DialogTitle className="text-[16px] font-semibold tracking-tight">
              Share {isFolder ? 'folder' : 'file'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80 flex items-center gap-1 truncate text-[12px]">
              <span className="truncate">{itemName}</span>
              {isFolder && itemCount > 0 && (
                <span className="shrink-0">
                  • {itemCount} item{itemCount !== 1 ? 's' : ''}
                </span>
              )}
            </DialogDescription>
          </div>

          {/* Input Wrapper */}
          <div className="relative mb-4">
            <div className="border-border/60 focus-within:border-primary/60 bg-background flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border p-1.5 transition-all focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]">
              {invitedUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-secondary border-border/60 flex shrink-0 items-center gap-1.5 rounded-md border py-0.5 pr-1 pl-1.5 text-[11px] font-medium"
                >
                  <span className="bg-primary/10 text-primary flex h-4 w-4 items-center justify-center rounded-full text-[9px]">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-foreground max-w-[120px] truncate">{user.name}</span>
                  <button
                    onClick={() => removeUser(user.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setShowAutocomplete(true)
                  setActiveIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowAutocomplete(true)}
                placeholder={
                  invitedUsers.length === 0 ? 'Add people by name or email' : 'Add more...'
                }
                className="placeholder:text-muted-foreground/50 min-w-[120px] flex-1 bg-transparent px-2 py-1 text-[13px] outline-none"
              />
            </div>

            {/* Simple Absolute Autocomplete - Constrained to parent width */}
            {showAutocomplete && inputValue.trim() !== '' && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAutocomplete(false)} />
                <div className="bg-popover border-border/60 animate-scale-in absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border shadow-xl">
                  {suggestions.length > 0 ? (
                    <div className="p-1.5">
                      {filteredUsers.length > 0 && (
                        <DropdownLabel className="px-2 pt-1.5 pb-1">Suggested people</DropdownLabel>
                      )}
                      {suggestions.map((suggestion, index) => {
                        const isActive = index === activeIndex
                        if (suggestion.type === 'user') {
                          return (
                            <button
                              key={suggestion.data.id}
                              onClick={() => handleSelectSuggestion(suggestion)}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                                isActive ? 'bg-accent' : 'hover:bg-accent'
                              )}
                            >
                              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold">
                                {suggestion.data.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium">
                                  {suggestion.data.name}
                                </p>
                                <p className="text-muted-foreground/60 truncate text-[11px]">
                                  {suggestion.data.email}
                                </p>
                              </div>
                            </button>
                          )
                        }
                        return (
                          <div key="invite-email-wrapper">
                            {filteredUsers.length > 0 && <DropdownSeparator />}
                            <button
                              onClick={() => handleSelectSuggestion(suggestion)}
                              onMouseEnter={() => setActiveIndex(index)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors',
                                isActive ? 'bg-accent' : 'hover:bg-accent'
                              )}
                            >
                              <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full">
                                <Mail className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium">
                                  Invite &ldquo;{suggestion.data.email}&rdquo;
                                </p>
                                <p className="text-muted-foreground/60 truncate text-[11px]">
                                  Send invitation via email
                                </p>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-muted-foreground/70 text-[13px]">No users found.</p>
                      <p className="text-muted-foreground/50 mt-1 text-[11px]">
                        Enter a valid email to invite.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mb-5 flex max-h-[200px] flex-col gap-1 overflow-y-auto">
            <div className="hover:bg-accent/30 flex items-center gap-3 rounded-md p-1.5">
              <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold">
                N
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">Nayan Rathod</p>
                <p className="text-muted-foreground/60 truncate text-[11px]">
                  nayanrathod23@gmail.com
                </p>
              </div>
              <span className="text-muted-foreground text-[12px] font-medium">Owner</span>
            </div>
            {invitedUsers.map((user) => (
              <div
                key={user.id}
                className="hover:bg-accent/30 group flex items-center gap-3 rounded-md p-1.5"
              >
                <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{user.name}</p>
                  <p className="text-muted-foreground/60 truncate text-[11px]">{user.email}</p>
                </div>
                <span className="text-muted-foreground text-[12px] font-medium group-hover:hidden">
                  Viewer
                </span>
                <button
                  onClick={() => removeUser(user.id)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hidden items-center rounded-md p-1 transition-colors group-hover:flex"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* General Access Dropdown - Removed w-full left-0 right-0 so it sizes to content generically */}
          <div className="mb-5">
            <DropdownMenu
              align="start"
              containerClassName="w-full"
              trigger={
                <div className="border-border/60 hover:bg-accent/30 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors">
                  <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full">
                    <ActiveAccessIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[13px] font-medium">
                      {accessType === 'invited' ? 'Invited only' : 'Anyone with link'}
                    </p>
                    <p className="text-muted-foreground/60 truncate text-[11px]">
                      {accessType === 'invited'
                        ? 'Only people added can open with this link'
                        : 'Anyone on the internet with the link can view'}
                    </p>
                  </div>
                  <ChevronDown className="text-muted-foreground/50 h-4 w-4" />
                </div>
              }
            >
              <DropdownLabel>General access</DropdownLabel>
              <DropdownItem onClick={() => setAccessType('invited')}>
                <Lock className="mr-2 h-4 w-4" /> Invited only
              </DropdownItem>
              <DropdownItem onClick={() => setAccessType('public')}>
                <Globe className="mr-2 h-4 w-4" /> Anyone with link
              </DropdownItem>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-secondary/40 border-border/60 mt-auto flex w-full flex-row items-center justify-between gap-3 rounded-b-2xl border-t p-4">
          <div className="relative w-full flex-1">
            <Link2 className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              readOnly
              value={shareLink}
              onFocus={(e) => e.currentTarget.select()}
              onClick={(e) => e.currentTarget.select()}
              className="bg-background border-border/60 focus:border-primary/60 h-9 w-full cursor-pointer truncate rounded-lg border pr-10 pl-9 text-[12px] transition-colors outline-none"
            />
            <button
              onClick={() => copy(shareLink)}
              className="hover:bg-accent text-muted-foreground hover:text-foreground absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-md p-1.5 transition-colors"
              title="Copy link"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <Button
            className="h-9 w-auto shrink-0 rounded-lg px-6"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
