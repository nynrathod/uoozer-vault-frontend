import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Shield, ArrowRight, AlertCircle } from 'lucide-react'

import { useAuth } from '@hooks/useAuth'
import { Button } from '@ui/Button'
import { Input } from '@ui/Input'
import { Label } from '@ui/Label'
import { ROUTES } from '@lib/constants'
import { cn } from '@lib/utils'
import { type LoginInput, loginSchema } from '@/lib/validator'
import { PasswordInput } from '@/components/ui/primitives/PasswordInput'
import { Checkbox } from '@/components/ui/primitives/Checkbox'

/** Login page with email/password form and "remember me" option. */
export function LoginPage() {
  const { login, isLoggingIn, loginError, clearLoginError } = useAuth()

  const {
    register,
    handleSubmit,
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
      <div className="mb-8 text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Shield className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Sign in to access your encrypted vault
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {loginError && (
          <div className="border-destructive/20 bg-destructive/10 text-destructive animate-fade-in flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{loginError}</span>
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
            className={cn(errors.email && 'border-destructive focus-visible:shadow-destructive/10')}
          />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            {...register('password')}
            className={cn(
              errors.password && 'border-destructive focus-visible:shadow-destructive/10'
            )}
          />
          {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox {...register('rememberMe')} />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <Link to={ROUTES.RECOVERY} className="text-primary text-sm hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="h-10 w-full rounded-lg" disabled={isLoggingIn}>
          {isLoggingIn ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Don't have an account?{' '}
        <Link to={ROUTES.SIGNUP} className="text-primary font-medium hover:underline">
          Create one
        </Link>
      </p>

      <div className="bg-muted/50 mt-8 rounded-xl border p-4">
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-foreground">Zero-knowledge security:</strong> Your password never
          leaves your device. We cannot reset it for you — keep your recovery key safe.
        </p>
      </div>
    </div>
  )
}
