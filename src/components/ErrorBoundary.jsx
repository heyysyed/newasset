import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--bg-subtle)] text-[var(--text-primary)]">
          <div className="max-w-md w-full bg-[var(--bg-surface)] shadow-xl rounded-xl p-8 border border-red-100">
            <h2 className="text-section-title text-[var(--status-danger)] mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Something went wrong
            </h2>
            <p className="text-small text-[var(--text-secondary)] mb-6">
              The application encountered an unexpected error. Please refresh the page or clear your browser cache if the issue persists.
            </p>
            <div className="bg-[var(--bg-subtle)] p-4 rounded text-caption text-[var(--text-muted)] overflow-auto mb-6 max-h-32 font-mono">
              {this.state.error && this.state.error.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-700 text-white text-body-medium py-2 px-4 rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}


