import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Shield,
} from 'lucide-react'
import { z } from 'zod'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { ROUTES } from '@lib/constants'
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

type Step1Input = z.infer<typeof step1Schema>
type Step2Input = z.infer<typeof step2Schema>

/** Two-step account recovery page styled with the shared Uoozer design system. */
export function RecoveryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [apiError, setApiError] = useState<ApiErrorAlert | null>(null)
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const { verifyRecoveryKey, completeRecovery, isSigningUp } = useAuth()

  const step1Form = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: { email: '', recoveryKey: '' },
  })

  const step2Form = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onStepOneSubmit = async (data: Step1Input) => {
    setApiError(null)

    try {
      await verifyRecoveryKey(data.email, data.recoveryKey)
      setEmail(data.email)
      setStep(2)
    } catch (error) {
      setApiError(mapErrorToAlert(error))
    }
  }

  const onStepTwoSubmit = async (data: Step2Input) => {
    setApiError(null)

    try {
      // The recovery key was verified in step 1; the DEK is already in the auth store.
      await completeRecovery(email, data.password)
      navigate(ROUTES.VAULT, { replace: true })
    } catch (error) {
      setApiError(mapErrorToAlert(error))
      setStep(1)
    }
  }

  const handleBack = () => {
    setApiError(null)
    setStep(1)
  }

  const step1Errors = step1Form.formState.errors
  const step2Errors = step2Form.formState.errors

  return (
    <div className="animate-fade-in w-full">
      <main className="text-ink mx-auto w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Shield className="text-primary h-5 w-5" strokeWidth={2} />
          <span className="text-base leading-6 font-semibold">Uoozer</span>
        </div>

        <header className="mt-8">
          <h1 className="text-h1 font-semibold tracking-tight">Recover your vault</h1>
          <p className="text-meta text-muted-foreground mt-1">
            {step === 1
              ? 'Enter your email and recovery key.'
              : 'Choose a new password for your account.'}
          </p>
        </header>

        {apiError && (
          <div
            role="alert"
            className="bg-danger-tint text-failed mt-6 flex items-start gap-2.5 rounded-lg p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-meta min-w-0 leading-relaxed">
              <p className="font-medium">{apiError.title}</p>
              <p className="text-failed/80">{apiError.message}</p>
            </div>
          </div>
        )}

        {step === 1 ? (
          <form
            onSubmit={step1Form.handleSubmit(onStepOneSubmit)}
            className="mt-8 flex flex-col gap-5"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-meta text-gray-ui font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(step1Errors.email)}
                {...step1Form.register('email')}
                className="uv-input"
              />
              {step1Errors.email && (
                <p className="text-meta text-failed mt-1">{step1Errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recoveryKey" className="text-meta text-gray-ui font-medium">
                Recovery key
              </Label>
              <Input
                id="recoveryKey"
                type="text"
                placeholder="Paste your recovery key"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(step1Errors.recoveryKey)}
                {...step1Form.register('recoveryKey')}
                className="uv-input font-mono"
              />
              {step1Errors.recoveryKey && (
                <p className="text-meta text-failed mt-1">{step1Errors.recoveryKey.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSigningUp}
              className="uv-btn uv-btn-primary uv-btn-lg w-full"
            >
              {isSigningUp ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Verify recovery key
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={step2Form.handleSubmit(onStepTwoSubmit)}
            className="mt-8 flex flex-col gap-5"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-meta text-gray-ui font-medium">
                New password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(step2Errors.password)}
                  {...step2Form.register('password')}
                  className="uv-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="uv-btn-icon text-ghost hover:bg-hover-surface hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {step2Errors.password && (
                <p className="text-meta text-failed mt-1">{step2Errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-meta text-gray-ui font-medium">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                aria-invalid={Boolean(step2Errors.confirmPassword)}
                {...step2Form.register('confirmPassword')}
                className="uv-input"
              />
              {step2Errors.confirmPassword && (
                <p className="text-meta text-failed mt-1">{step2Errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                className="uv-btn uv-btn-ghost"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSigningUp}
                className="uv-btn uv-btn-primary uv-btn-lg flex-1"
              >
                {isSigningUp ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recovering...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Reset and unlock
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}

        <p className="text-meta text-muted-foreground mt-6 text-center">
          Remembered your password?{' '}
          <Link
            to={ROUTES.LOGIN}
            className="text-blue-ink font-medium hover:underline focus-visible:rounded-sm"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  )
}
