import { Link } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, LockKeyhole, Shield } from 'lucide-react'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { ROUTES } from '@lib/constants'
import { type LoginInput, loginSchema } from '@/lib/validator'
import { PasswordInput } from '@/components/ui/primitives/PasswordInput'
import { Checkbox } from '@/components/ui/primitives/Checkbox'

export function LoginPage() {
  const { login, isLoggingIn, loginError, clearLoginError } = useAuth()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = async (data: LoginInput) => {
    clearLoginError()
    await login({
      email: data.email,
      password: data.password,
      rememberMe: data.rememberMe,
    })
  }

  return (
    <div className="animate-fade-in w-full">
      <main className="text-ink mx-auto w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Shield className="text-primary size-5" strokeWidth={2} aria-hidden="true" />
          <span className="text-ui text-ink font-semibold">Uoozer</span>
        </div>

        <header className="mt-9">
          <h1 className="text-h1 text-ink">Welcome back</h1>
          <p className="text-muted-foreground mt-1.5 text-base leading-6">
            Unlock your encrypted files and notes.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-4" noValidate>
          {loginError && (
            <div
              role="alert"
              className="border-failed/20 bg-failed-tint text-meta text-failed flex items-start gap-2 rounded-lg border px-3 py-2.5"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-meta text-gray-ui mb-1.5 block font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
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
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
              className="uv-input"
            />
            {errors.password && (
              <p className="text-section-label text-failed mt-1.5">{errors.password.message}</p>
            )}
          </div>

          <div className="text-meta flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="rememberMe"
                render={({ field }) => (
                  <Checkbox
                    id="rememberMe"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    ref={field.ref}
                  />
                )}
              />
              <label htmlFor="rememberMe" className="text-muted-foreground cursor-pointer">
                Remember this device
              </label>
            </div>
            <Link
              to={ROUTES.RECOVERY}
              className="text-blue-ink shrink-0 font-medium hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isLoggingIn}
            className="uv-btn uv-btn-lg uv-btn-primary w-full gap-2"
          >
            {isLoggingIn ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Unlocking vault...
              </>
            ) : (
              <>
                Unlock vault
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        <p className="text-meta text-muted-foreground mt-6 text-center">
          New to Uoozer?{' '}
          <Link to={ROUTES.SIGNUP} className="text-blue-ink font-medium hover:underline">
            Create a vault
          </Link>
        </p>

        <div className="bg-hover-surface text-meta text-muted-foreground mt-10 flex gap-3 rounded-lg p-4">
          <LockKeyhole
            className="text-sealed mt-0.5 size-4 shrink-0"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <p>
            <strong className="text-ink font-semibold">Zero-knowledge.</strong> Your password
            becomes a key on this device and never leaves it. We can’t reset it, so keep your
            recovery key safe.
          </p>
        </div>

        <p className="text-section-label text-muted-foreground mt-3 text-center">
          Argon2id · XChaCha20-Poly1305
        </p>
      </main>
    </div>
  )
}
