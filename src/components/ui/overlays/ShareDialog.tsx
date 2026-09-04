import { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogDescription } from '@ui/Dialog'
import { Button } from '@ui/Button'
import { Copy, Check, Globe, Lock, Mail, X, ChevronDown, Link2, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownItem, DropdownLabel } from '@ui/DropdownMenu'
import { useClipboard } from '@hooks/useClipboard'
import { useItemActions } from '@hooks/useItemActions'
import { toast } from 'sonner'
import type { FileItem } from '@/types/files'
import type { Folder } from '@/types/folders'

/** Props for the share dialog overlay. */
interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: FileItem | Folder | null
}

/** Dialog for inviting users and configuring link-based access to a file or folder. */
export function ShareDialog({ open, onOpenChange, item }: ShareDialogProps) {
  const { copied, copy } = useClipboard()
  const { handleCopyLink, isGeneratingLink, shareUrl } = useItemActions(item, () => {})

  const [accessType, setAccessType] = useState<'public' | 'restricted'>('public')
  const [inputValue, setInputValue] = useState('')
  const [invitedEmails, setInvitedEmails] = useState<string[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)

  const isFolder = item ? 'parentId' in item : false
  const itemName = item?.name || 'this item'

  useEffect(() => {
    if (!open) {
      setAccessType('public')
      setInputValue('')
      setInvitedEmails([])
      setShowAutocomplete(false)
    }
  }, [open])

  const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email)

  const addEmail = (email: string) => {
    if (!invitedEmails.includes(email) && isValidEmail(email)) {
      setInvitedEmails([...invitedEmails, email])
    }
    setInputValue('')
    setShowAutocomplete(false)
  }

  const removeEmail = (email: string) => setInvitedEmails(invitedEmails.filter((e) => e !== email))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && inputValue === '' && invitedEmails.length > 0) {
      removeEmail(invitedEmails[invitedEmails.length - 1])
      return
    }
    if (e.key === 'Enter' && isValidEmail(inputValue)) {
      e.preventDefault()
      addEmail(inputValue)
    }
  }

  const ActiveAccessIcon = accessType === 'restricted' ? Lock : Globe

  const handleAccessChange = (type: 'public' | 'restricted') => {
    setAccessType(type)
    if (shareUrl) {
      handleCopyLink(type)
    }
  }

  const handleCreateLink = () => {
    handleCopyLink(accessType)
  }

  const handleCopyExisting = () => {
    if (shareUrl) {
      copy(shareUrl)
      toast.success('Secure link copied to clipboard!')
    }
  }

  if (!item) return null

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
            </DialogDescription>
          </div>

          <div className="relative mb-4">
            <div className="border-border/60 focus-within:border-primary/60 bg-background flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border p-1.5 transition-all focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]">
              {invitedEmails.map((email) => (
                <div
                  key={email}
                  className="bg-secondary border-border/60 flex shrink-0 items-center gap-1.5 rounded-md border py-0.5 pr-1 pl-1.5 text-[11px] font-medium"
                >
                  <span className="bg-primary/10 text-primary flex h-4 w-4 items-center justify-center rounded-full text-[9px]">
                    {email.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-foreground max-w-[120px] truncate">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
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
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowAutocomplete(true)}
                placeholder={invitedEmails.length === 0 ? 'Add people by email' : 'Add more...'}
                className="placeholder:text-muted-foreground/50 min-w-[120px] flex-1 bg-transparent px-2 py-1 text-[13px] outline-none"
              />
            </div>

            {showAutocomplete && isValidEmail(inputValue) && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAutocomplete(false)} />
                <div className="bg-popover border-border/60 animate-scale-in absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-xl border shadow-xl">
                  <div className="p-1.5">
                    <button
                      onClick={() => addEmail(inputValue)}
                      className="hover:bg-accent flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors"
                    >
                      <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          Invite &ldquo;{inputValue}&rdquo;
                        </p>
                        <p className="text-muted-foreground/60 truncate text-[11px]">
                          Send invitation via email
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {invitedEmails.length > 0 && (
            <div className="mb-5 flex max-h-[200px] flex-col gap-1 overflow-y-auto">
              {invitedEmails.map((email) => (
                <div
                  key={email}
                  className="hover:bg-accent/30 group flex items-center gap-3 rounded-md p-1.5"
                >
                  <div className="bg-secondary text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{email}</p>
                  </div>
                  <span className="text-muted-foreground text-[12px] font-medium group-hover:hidden">
                    Viewer
                  </span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hidden items-center rounded-md p-1 transition-colors group-hover:flex"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

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
                      {accessType === 'restricted' ? 'Restricted' : 'Anyone with link'}
                    </p>
                    <p className="text-muted-foreground/60 truncate text-[11px]">
                      {accessType === 'restricted'
                        ? 'Only logged in users can access'
                        : 'Anyone on the internet with the link can view'}
                    </p>
                  </div>
                  <ChevronDown className="text-muted-foreground/50 h-4 w-4" />
                </div>
              }
            >
              <DropdownLabel>General access</DropdownLabel>
              <DropdownItem onClick={() => handleAccessChange('public')}>
                <Globe className="mr-2 h-4 w-4" /> Anyone with link
              </DropdownItem>
              <DropdownItem onClick={() => handleAccessChange('restricted')}>
                <Lock className="mr-2 h-4 w-4" /> Restricted
              </DropdownItem>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-secondary/40 border-border/60 mt-auto flex w-full flex-row items-center justify-between gap-3 rounded-b-2xl border-t p-4">
          {!shareUrl ? (
            <Button
              type="button"
              onClick={handleCreateLink}
              disabled={isGeneratingLink}
              className="h-9 w-full gap-2 rounded-lg"
            >
              {isGeneratingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isGeneratingLink ? 'Generating...' : 'Create secure link'}
            </Button>
          ) : (
            <>
              <div className="relative w-full flex-1">
                <Link2 className="text-muted-foreground/50 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  className="bg-background border-border/60 focus:border-primary/60 h-9 w-full cursor-pointer truncate rounded-lg border pr-10 pl-9 text-[12px] transition-colors outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyExisting}
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
                type="button"
                className="h-9 w-auto shrink-0 rounded-lg px-6"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
