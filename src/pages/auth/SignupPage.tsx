import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  Key,
  LockKeyhole,
  Shield,
} from 'lucide-react'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { CopyButton } from '@ui/CopyButton'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@ui/Dialog'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { type SignupInput, signupSchema } from '@/lib/validator'
import { AuthError } from '@/services/auth/error'
import { mapErrorToAlert, type ApiErrorAlert } from '@/lib/errors'
import { PasswordInput } from '@/components/ui/primitives/PasswordInput'
import { Checkbox } from '@/components/ui/primitives/Checkbox'

export function SignupPage() {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [cryptoBundle, setCryptoBundle] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [isEnteringVault, setIsEnteringVault] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const [apiError, setApiError] = useState<ApiErrorAlert | null>(null)

  const { signup, completeSignup, isSigningUp } = useAuth()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  })

  const password = watch('password')
  const strongPassword =
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)

  const downloadRecoveryKey = () => {
    const blob = new Blob([recoveryKey], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = 'uoozer-vault-recovery-key.txt'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
    window.setTimeout(() => setDownloaded(false), 2000)
  }

  const onSubmit = async (data: SignupInput) => {
    setApiError(null)

    try {
      const result = await signup({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        deviceName: 'Web Browser',
        acceptTerms: data.acceptTerms,
      })

      setRecoveryKey(result.recoveryKey)
      setCryptoBundle(result.cryptoBundle)
      setUserEmail(data.email)
      setAcknowledged(false)
      setCompletionError('')
      setIsModalOpen(true)
    } catch (error) {
      if (error instanceof AuthError || error instanceof Error) {
        setApiError(mapErrorToAlert(error))
      } else {
        setApiError({ title: 'Unknown error', message: 'Something went wrong. Please try again.' })
      }
    }
  }

  const handleEnterVault = async () => {
    setCompletionError('')
    setIsEnteringVault(true)

    try {
      await completeSignup(cryptoBundle, userEmail, watch('fullName'))
      setIsModalOpen(false)
      navigate(ROUTES.VAULT)
    } catch (error) {
      if (error instanceof AuthError || error instanceof Error) {
        const alert = mapErrorToAlert(error)
        setCompletionError(alert.message)
      } else {
        setCompletionError('Unable to finish setting up your vault. Please try again.')
      }
    } finally {
      setIsEnteringVault(false)
    }
  }

  return (
    <div className="animate-fade-in w-full">
      <main className="text-ink mx-auto w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Shield className="text-primary size-5" strokeWidth={2} aria-hidden="true" />
          <span className="text-ui text-ink font-semibold">Uoozer</span>
        </div>

        <header className="mt-9">
          <h1 className="text-h1 text-ink">Create your vault</h1>
          <p className="text-muted-foreground mt-1.5 text-base leading-6">
            Start your zero-knowledge encrypted storage.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
          {apiError && (
            <div
              role="alert"
              className="border-failed/20 bg-failed-tint text-meta text-failed flex items-start gap-2.5 rounded-lg border p-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{apiError.title}</p>
                <p>{apiError.message}</p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="fullName" className="text-meta text-gray-ui mb-1.5 block font-medium">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              {...register('fullName')}
              className="uv-input"
            />
            {errors.fullName && (
              <p className="text-section-label text-failed mt-1.5">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email" className="text-meta text-gray-ui mb-1.5 block font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
              className="uv-input"
            />
            {errors.email && (
              <p className="text-section-label text-failed mt-1.5">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password" className="text-meta text-gray-ui mb-1.5 block font-medium">
              Password
            </Label>
            <PasswordInput
              id="password"
              placeholder="Create a strong password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
              className="uv-input"
            />
            {errors.password && (
              <p className="text-section-label text-failed mt-1.5">{errors.password.message}</p>
            )}
            {password.length > 0 && (
              <div className="mt-2 flex gap-1" aria-label="Password strength indicator">
                {[1, 2, 3, 4].map((segment) => (
                  <span
                    key={segment}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      password.length >= segment * 3
                        ? strongPassword
                          ? 'bg-sealed'
                          : 'bg-headsup'
                        : 'bg-line'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <Label
              htmlFor="confirmPassword"
              className="text-meta text-gray-ui mb-1.5 block font-medium"
            >
              Confirm password
            </Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
              className="uv-input"
            />
            {errors.confirmPassword && (
              <p className="text-section-label text-failed mt-1.5">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-start gap-2.5">
              <Controller
                control={control}
                name="acceptTerms"
                render={({ field }) => (
                  <Checkbox
                    id="acceptTerms"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    ref={field.ref}
                  />
                )}
              />
              <label
                htmlFor="acceptTerms"
                className={cn(
                  'text-meta text-muted-foreground cursor-pointer',
                  errors.acceptTerms && 'text-failed'
                )}
              >
                I understand that losing my password and recovery key means losing access to my data
                permanently. Uoozer cannot recover it for me.
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="text-section-label text-failed mt-1.5">{errors.acceptTerms.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSigningUp}
            className="uv-btn uv-btn-lg uv-btn-primary w-full gap-2"
          >
            {isSigningUp ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating vault...
              </>
            ) : (
              <>
                Create vault
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        <p className="text-meta text-muted-foreground mt-6 text-center">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-blue-ink font-medium hover:underline">
            Sign in
          </Link>
        </p>

        <div className="bg-hover-surface text-meta text-muted-foreground mt-8 flex gap-3 rounded-lg p-4">
          <LockKeyhole
            className="text-sealed mt-0.5 size-4 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <p>
            <strong className="text-ink font-semibold">Zero-knowledge.</strong> Your password
            becomes a key on this device and never leaves it. Save your recovery key when it
            appears; it will only be shown once.
          </p>
        </div>

        <p className="text-section-label text-muted-foreground mt-3 text-center">
          Argon2id · XChaCha20-Poly1305
        </p>
      </main>

      <Dialog
        open={isModalOpen}
        // The recovery-key step is mandatory; users dismiss it by completing setup.
        onOpenChange={() => undefined}
        className="w-full max-w-lg rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-h3 text-ink flex items-center gap-2 text-left">
            <Key className="text-headsup size-5" aria-hidden="true" />
            Save your recovery key
          </DialogTitle>
          <DialogDescription className="text-meta text-muted-foreground text-left">
            This is the only way to recover your account if you forget your password. Save it
            somewhere safe. You will never see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          <div className="border-border bg-hover-surface text-section-label text-ink max-h-36 overflow-y-auto rounded-lg border p-3 font-mono leading-5 break-all">
            {recoveryKey}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <CopyButton
              value={recoveryKey}
              variant="secondary"
              size="sm"
              className="uv-btn uv-btn-secondary"
            >
              Copy key
            </CopyButton>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={downloadRecoveryKey}
              className="uv-btn uv-btn-secondary gap-1.5"
            >
              {downloaded ? <Check className="size-4" /> : <ArrowDownToLine className="size-4" />}
              {downloaded ? 'Downloaded' : 'Download .txt'}
            </Button>
          </div>

          <div className="bg-headsup-tint text-headsup rounded-lg p-3">
            <p className="text-section-label leading-5">
              <strong className="font-semibold">Important:</strong> If you lose your password and do
              not have this recovery key, your data is permanently lost. Uoozer cannot recover it.
            </p>
          </div>

          {completionError && (
            <p role="alert" className="text-meta text-failed">
              {completionError}
            </p>
          )}

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="recoveryKeyAcknowledged"
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
            />
            <label
              htmlFor="recoveryKeyAcknowledged"
              className="text-meta text-muted-foreground cursor-pointer"
            >
              I have saved my recovery key and understand the risks.
            </label>
          </div>

          <Button
            type="button"
            onClick={handleEnterVault}
            disabled={!acknowledged || isEnteringVault}
            className="uv-btn uv-btn-lg uv-btn-primary w-full gap-2"
          >
            {isEnteringVault ? 'Setting up vault...' : 'Enter my vault'}
            {!isEnteringVault && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
