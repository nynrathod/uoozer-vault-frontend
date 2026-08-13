import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Shield, ArrowRight, AlertCircle, Check, Key, Loader2, ArrowDownToLine } from 'lucide-react'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { PasswordInput } from '@ui/PasswordInput'
import { Checkbox } from '@ui/Checkbox'
import { CopyButton } from '@ui/CopyButton'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@ui/Dialog'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { type SignupInput, signupSchema } from '@/lib/validator'
import { AuthError } from '@/services/auth/error'
import { mapErrorToAlert, type ApiErrorAlert } from '@/lib/errors'

export function SignupPage() {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [recoveryKey, setRecoveryKey] = useState('')
  const [cryptoBundle, setCryptoBundle] = useState<any>(null)
  const [userEmail, setUserEmail] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
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
    defaultValues: { email: '', password: '', confirmPassword: '', acceptTerms: false },
  })

  const password = watch('password')

  const downloadRecoveryKey = () => {
    const blob = new Blob([recoveryKey], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'uoozer-vault-recovery-key.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const onSubmit = async (data: SignupInput) => {
    setApiError(null)
    try {
      const result = await signup({
        email: data.email,
        password: data.password,
        deviceName: 'Web Browser',
        acceptTerms: data.acceptTerms,
      })
      setRecoveryKey(result.recoveryKey)
      setCryptoBundle(result.cryptoBundle)
      setUserEmail(data.email)
      setIsModalOpen(true)
    } catch (error) {
      if (error instanceof AuthError || error instanceof Error) setApiError(mapErrorToAlert(error))
      else setApiError({ title: 'Unknown Error', message: 'Something went wrong.' })
    }
  }

  const handleEnterVault = async () => {
    await completeSignup(cryptoBundle, userEmail)
    setIsModalOpen(false)
    navigate(ROUTES.VAULT)
  }

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-8 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Shield className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your vault</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Start your zero-knowledge encrypted storage
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {apiError && (
          <div className="border-destructive/20 bg-destructive/5 text-destructive animate-fade-in flex items-start gap-2.5 rounded-lg border p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-[13px] leading-relaxed">
              <p className="font-medium">{apiError.title}</p>
              <p className="text-destructive/80">{apiError.message}</p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
            className={cn(errors.email && 'border-destructive')}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            {...register('password')}
            className={cn(errors.password && 'border-destructive')}
          />
          {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          {password && password.length > 0 && (
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-150',
                    password.length >= i * 3
                      ? password.length >= 12 &&
                        /[A-Z]/.test(password) &&
                        /[0-9]/.test(password) &&
                        /[^A-Za-z0-9]/.test(password)
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                      : 'bg-muted'
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Confirm your password"
            autoComplete="new-password"
            {...register('confirmPassword')}
            className={cn(errors.confirmPassword && 'border-destructive')}
          />
          {errors.confirmPassword && (
            <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div className="flex items-start gap-2.5">
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <Checkbox
                id="acceptTerms"
                checked={field.value}
                onCheckedChange={field.onChange}
                ref={field.ref}
                className="data-[state=unchecked]:border-border mt-0.5"
              />
            )}
          />
          <label
            htmlFor="acceptTerms"
            className={cn(
              'text-muted-foreground text-sm',
              errors.acceptTerms && 'text-destructive'
            )}
          >
            I understand that losing my password and recovery key means losing access to my data
            permanently. No one, including Uoozer, can recover it for me.
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-destructive -mt-2 text-xs">{errors.acceptTerms.message}</p>
        )}

        <Button type="submit" className="h-10 w-full rounded-lg" disabled={isSigningUp}>
          {isSigningUp ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Creating vault...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Create vault <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Key className="h-5 w-5 text-amber-500" /> Save your recovery key
          </DialogTitle>
          <DialogDescription className="text-left text-[13px]">
            This is the only way to recover your account if you forget your password. Save it
            somewhere safe. You will never see it again.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="bg-muted/50 flex-1 rounded-lg border p-3 font-mono text-[11px] tracking-wide break-all">
            {recoveryKey}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <CopyButton value={recoveryKey} variant="secondary" size="sm" className="gap-1.5">
              Copy Key
            </CopyButton>
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadRecoveryKey}
              className={cn('gap-1.5', downloaded && 'text-emerald-500')}
            >
              {downloaded ? <Check className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
              {downloaded ? 'Downloaded' : 'Download .txt'}
            </Button>
          </div>

          <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3">
            <p className="text-destructive text-[11px] leading-relaxed">
              <strong>Warning:</strong> If you lose your password and don't have this recovery key,
              your data is permanently lost. We cannot recover it for you.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(val) => setAcknowledged(val === true)}
              className="data-[state=unchecked]:border-border mt-0.5"
            />
            <span className="text-muted-foreground">
              I have saved my recovery key and understand the risks.
            </span>
          </label>

          <Button
            onClick={handleEnterVault}
            disabled={!acknowledged}
            className="h-10 w-full gap-2 rounded-lg"
          >
            Enter my vault <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
