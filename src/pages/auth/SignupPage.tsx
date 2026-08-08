import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Shield, ArrowRight, AlertCircle, Check, Copy, Key } from 'lucide-react'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { type SignupInput, signupSchema } from '@/lib/validator'

export function SignupPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step, setStep] = useState<'form' | 'recovery'>('form')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [copied, setCopied] = useState(false)
  const { signup, isSigningUp, signupError, clearSignupError } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  })

  const password = watch('password')

  const onSubmit = async (data: SignupInput) => {
    clearSignupError()
    try {
      const result = await signup({
        email: data.email,
        password: data.password,
        deviceName: 'Web Browser',
        acceptTerms: data.acceptTerms,
      })
      setRecoveryKey(result.recoveryKey)
      setStep('recovery')
    } catch {
      // Error is handled by hook state
    }
  }

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-8 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Shield className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 'form' ? 'Create your vault' : 'Save your recovery key'}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {step === 'form'
            ? 'Start your zero-knowledge encrypted storage'
            : 'This is the only way to recover your account'}
        </p>
      </div>

      {step === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {signupError && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive animate-fade-in flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{signupError}</span>
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                autoComplete="new-password"
                {...register('password')}
                className={cn('pr-10', errors.password && 'border-destructive')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}

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
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm your password"
                autoComplete="new-password"
                {...register('confirmPassword')}
                className={cn('pr-10', errors.confirmPassword && 'border-destructive')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>
            )}
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              {...register('acceptTerms')}
              className="border-border text-primary focus:ring-primary mt-0.5 h-4 w-4 rounded"
            />
            <span className={cn('text-muted-foreground', errors.acceptTerms && 'text-destructive')}>
              I understand that losing my password and recovery key means losing access to my data
              permanently. No one, including Uoozer, can recover it for me.
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="text-destructive -mt-2 text-xs">{errors.acceptTerms.message}</p>
          )}

          <Button type="submit" className="h-10 w-full rounded-lg" disabled={isSigningUp}>
            {isSigningUp ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Creating vault...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Create vault
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <div className="animate-fade-in space-y-6">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Key className="h-4 w-4" />
              <span className="text-sm font-medium">Recovery Key</span>
            </div>
            <p className="text-muted-foreground mb-3 text-xs">
              Save this key somewhere safe (password manager, printed copy). You will never see it
              again.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-background flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm tracking-wider">
                {recoveryKey}
              </code>
              <Button
                variant="secondary"
                size="icon"
                onClick={copyRecoveryKey}
                className={cn(copied && 'text-emerald-500')}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 space-y-2 rounded-xl border p-4">
            <p className="text-foreground text-xs font-medium">What happens if I lose this key?</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your data is encrypted with your password. If you forget your password and don't have
              this recovery key, your data is permanently lost. We cannot help you recover it.
            </p>
          </div>

          <Button onClick={() => navigate(ROUTES.VAULT)} className="h-10 w-full rounded-lg">
            I've saved it — go to my vault
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 'form' && (
        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  )
}
