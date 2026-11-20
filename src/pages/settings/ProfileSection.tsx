import { Mail, Save, Loader2, Camera, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { useAuth } from '@hooks/useAuth'

export function ProfileSection() {
  const { user, updateProfile, uploadAvatar, removeAvatar } = useAuth()

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')

  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '')
      setAvatarUrl(user.avatarUrl || '')
    }
  }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]

    if (!file) return

    setIsUploadingAvatar(true)

    try {
      const url = await uploadAvatar(file)
      setAvatarUrl(url)
    } catch (err) {
      // Preserve the existing auth/service error handling.
    } finally {
      setIsUploadingAvatar(false)
      input.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)

    try {
      await removeAvatar()
      setAvatarUrl('')
    } catch (err) {
      // Preserve the existing auth/service error handling.
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
      // Preserve the existing auth/service error handling.
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <section className="w-full">
      <div className="bg-card rounded-2xl">
        {/* Header */}
        <header className="mb-5">
          <h2 className="text-h3 text-ink">Profile</h2>
          <p className="text-meta text-muted-foreground mt-0.5">
            Update your personal information.
          </p>
        </header>

        <form onSubmit={handleProfileSubmit}>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="bg-tint text-blue-ink flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold">
              {isUploadingAvatar ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                user?.email?.charAt(0).toUpperCase() || 'U'
              )}
            </div>

            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {avatarUrl ? 'Change photo' : 'Upload photo'}
                </Button>

                {avatarUrl && (
                  <Button
                    type="button"
                    variant="destructiveText"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>

              <p className="text-meta text-muted-foreground">JPG, PNG or GIF. Stored encrypted.</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={isUploadingAvatar}
            />
          </div>

          {/* Full name */}
          <div className="mt-5 space-y-1.5">
            <label htmlFor="fullName" className="text-meta text-gray-ui block font-medium">
              Full name
            </label>

            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="uv-input"
              autoComplete="name"
              required
            />
          </div>

          {/* Email */}
          <div className="mt-4 space-y-1.5">
            <label htmlFor="profileEmail" className="text-meta text-gray-ui block font-medium">
              Email
            </label>

            <div className="relative">
              <Mail className="text-ghost absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />

              <Input
                id="profileEmail"
                type="email"
                value={user?.email || ''}
                className="uv-input text-muted-foreground pl-10"
                disabled
              />
            </div>

            <p className="text-meta text-muted-foreground">Your sign-in email is read-only.</p>
          </div>

          {/* Save */}
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="default" size="default" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
