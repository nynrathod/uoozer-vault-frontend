import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .max(254, 'Email is too long')

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
})

export const signupSchema = z
  .object({
    email: emailSchema,
    fullName: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const recoveryKeySchema = z.object({
  recoveryKey: z
    .string()
    .min(1, 'Recovery key is required')
    .regex(/^[a-z0-9]+$/, 'Recovery key contains invalid characters'),
})

export const folderNameSchema = z
  .string()
  .min(1, 'Folder name is required')
  .max(255, 'Folder name is too long')
  .regex(/^[^/\\:*?"<>|]+$/, 'Folder name contains invalid characters')

export const fileNameSchema = z
  .string()
  .min(1, 'File name is required')
  .max(255, 'File name is too long')

export const renameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
})

export const deviceNameSchema = z
  .string()
  .min(1, 'Device name is required')
  .max(100, 'Device name is too long')

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type RecoveryKeyInput = z.infer<typeof recoveryKeySchema>
export type FolderNameInput = z.infer<typeof folderNameSchema>
export type RenameInput = z.infer<typeof renameSchema>
