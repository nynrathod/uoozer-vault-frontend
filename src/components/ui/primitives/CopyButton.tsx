import { Copy, Check } from 'lucide-react'
import { Button, type ButtonProps } from './Button'
import { useClipboard } from '@hooks/useClipboard'
import { cn } from '@lib/utils'

interface CopyButtonProps extends ButtonProps {
  value: string
}

export function CopyButton({ value, children, className, onClick, ...props }: CopyButtonProps) {
  const { copied, copy } = useClipboard()

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    copy(value)
    onClick?.(e)
  }

  return (
    <Button onClick={handleCopy} className={cn(copied && 'text-emerald-500', className)} {...props}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {children}
    </Button>
  )
}
