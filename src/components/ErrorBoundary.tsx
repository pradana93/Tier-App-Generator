import React from 'react'

interface Props {
  children: React.ReactNode
}
interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-[#1a1a1e] border border-red-900/50 rounded-xl p-6">
            <h2 className="text-red-400 font-bold text-lg">Something went wrong</h2>
            <pre className="mt-3 text-xs font-mono text-zinc-400 whitespace-pre-wrap break-words bg-[#0f0f12] p-3 rounded border border-[#2a2a30]">
              {this.state.error?.message ?? 'Unknown error'}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 w-full bg-[#252529] border border-[#333] hover:bg-[#2a2a30] text-white py-2 rounded font-mono text-sm"
            >
              Try again
            </button>
            <button onClick={() => location.reload()} className="mt-2 w-full text-zinc-500 text-xs font-mono hover:text-zinc-300">
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
