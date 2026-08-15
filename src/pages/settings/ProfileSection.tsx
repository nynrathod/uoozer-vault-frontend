import { Mail, Save, KeyRound, Loader2, Camera, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Separator } from '@ui/Separator'
import { SectionHeader } from '@/components/ui'
import { useAuth } from '@hooks/useAuth'
import { passwordSchema } from '@/lib/validator'

export function ProfileSection() {
  const { user, updateProfile, changePassword, uploadAvatar, removeAvatar } = useAuth()

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '')
      setAvatarUrl(user.avatarUrl || '')
    }
  }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const url = await uploadAvatar(file)
      setAvatarUrl(url)
    } catch (err) {
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)
    try {
      await removeAvatar()
      setAvatarUrl('')
    } catch (err) {
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      await updateProfile(fullName)
    } catch (err) {
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validation = passwordSchema.safeParse(newPassword)
    if (!validation.success) {
      toast.error(validation.error.issues[0].message)
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsSavingPassword(true)
    try {
      await changePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeader title="Profile" description="Update your personal information." />

      <form onSubmit={handleProfileSubmit} className="space-y-6">
        <div className="flex items-center gap-5">
          <div className="bg-primary/10 text-primary border-border/60 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border text-2xl font-semibold">
            {isUploadingAvatar ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              user?.email?.charAt(0).toUpperCase() || 'U'
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 rounded-lg font-medium"
              >
                <Camera className="h-4 w-4" />
                {avatarUrl ? 'Change Photo' : 'Upload Photo'}
              </Button>

              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  className="text-muted-foreground hover:text-destructive gap-1.5 rounded-lg font-medium"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-muted-foreground/60 text-[11px]">
              JPG, PNG, or GIF. Click remove to delete.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Full Name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-lg"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Email Address</label>
          <div className="relative">
            <Mail className="text-muted-foreground/60 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input value={user?.email || ''} className="rounded-lg pl-9" disabled />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="gap-1.5 rounded-lg" disabled={isSavingProfile}>
            {isSavingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSavingProfile ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <Separator />

      <SectionHeader title="Security" description="Change your vault password." />

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">New Password</label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter a new strong password"
            className="rounded-lg"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[13px] font-medium">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className="rounded-lg"
            required
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            className="gap-1.5 rounded-lg"
            disabled={isSavingPassword}
          >
            {isSavingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {isSavingPassword ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </div>
  )
}
