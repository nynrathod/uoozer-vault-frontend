import { Component, type ReactNode } from 'react'
import { Button } from '@components/ui/primitives/Button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { ErrorInfo } from 'react-dom/client'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="bg-destructive/10 text-destructive mb-6 flex h-16 w-16 items-center justify-center rounded-full">
            <AlertTriangle className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-muted-foreground mb-6 max-w-md text-sm leading-relaxed">
            An unexpected error occurred. You can try refreshing the page, or if the problem
            persists, please contact support.
          </p>
          {this.state.error && (
            <pre className="bg-muted text-muted-foreground mb-6 max-w-2xl overflow-auto rounded-lg p-4 text-left text-xs">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
            <Button onClick={this.handleReset}>Try Again</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
