import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, ArrowRight, AlertCircle, Check, Key, Loader2, ArrowLeft } from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { mapErrorToAlert, type ApiErrorAlert } from '@/lib/errors'

const step1Schema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  recoveryKey: z.string().min(1, 'Recovery key is required'),
})

const step2Schema = z
  .object({
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function RecoveryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [apiError, setApiError] = useState<ApiErrorAlert | null>(null)
  const [email, setEmail] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const { verifyRecoveryKey, completeRecovery, isSigningUp } = useAuth()

  const step1Form = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: '', recoveryKey: '' },
  })

  const step2Form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onStepOneSubmit = async (data: z.infer<typeof step1Schema>) => {
    setApiError(null)
    try {
      await verifyRecoveryKey(data.email, data.recoveryKey)
      setEmail(data.email)

      setStep(2)
    } catch (error) {
      setApiError(mapErrorToAlert(error))
    }
  }

  const onStepTwoSubmit = async (data: z.infer<typeof step2Schema>) => {
    setApiError(null)
    try {
      // The recovery key was already verified in Step 1 and the DEK is stored in the auth store.
      // We only need to pass the new password here.
      await completeRecovery(email, data.password)
      navigate(ROUTES.VAULT, { replace: true })
    } catch (error) {
      setApiError(mapErrorToAlert(error))
      setStep(1) // Send them back if something breaks during the final reset
    }
  }

  return (
    <div className="animate-fade-in w-full">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Key className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Recover your vault</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          {step === 1 ? 'Enter your email and recovery key' : 'Set a new password for your account'}
        </p>
      </div>

      {apiError && (
        <div className="border-destructive/20 bg-destructive/5 text-destructive animate-fade-in mb-4 flex items-start gap-2.5 rounded-lg border p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-[13px] leading-relaxed">
            <p className="font-medium">{apiError.title}</p>
            <p className="text-destructive/80">{apiError.message}</p>
          </div>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={step1Form.handleSubmit(onStepOneSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...step1Form.register('email')}
              className={cn(step1Form.formState.errors.email && 'border-destructive')}
            />
            {step1Form.formState.errors.email && (
              <p className="text-destructive text-xs">{step1Form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recoveryKey">Recovery Key</Label>
            <Input
              id="recoveryKey"
              type="text"
              placeholder="12345678-90abcdef-..."
              className="font-mono tracking-wider"
              {...step1Form.register('recoveryKey')}
            />
          </div>

          <Button type="submit" className="h-10 w-full rounded-lg" disabled={isSigningUp}>
            {isSigningUp ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={step2Form.handleSubmit(onStepTwoSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter a new strong password"
                autoComplete="new-password"
                {...step2Form.register('password')}
                className={cn('pr-10', step2Form.formState.errors.password && 'border-destructive')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {step2Form.formState.errors.password && (
              <p className="text-destructive text-xs">
                {step2Form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your new password"
              autoComplete="new-password"
              {...step2Form.register('confirmPassword')}
              className={cn(step2Form.formState.errors.confirmPassword && 'border-destructive')}
            />
            {step2Form.formState.errors.confirmPassword && (
              <p className="text-destructive text-xs">
                {step2Form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-lg"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button type="submit" className="h-10 flex-1 rounded-lg" disabled={isSigningUp}>
              {isSigningUp ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recovering...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Reset & Unlock
                  <Check className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </form>
      )}

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered your password?{' '}
        <Link to={ROUTES.LOGIN} className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
