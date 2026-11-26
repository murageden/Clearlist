import { Component, type ErrorInfo, type ReactNode } from 'react';
import { getFriendlyErrorMessage, parseFirestoreErrorInfo } from '../lib/firestoreErrors';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const firestoreInfo = parseFirestoreErrorInfo(this.state.error);
      const friendlyMessage = getFriendlyErrorMessage(this.state.error);

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
              Workspace error
            </p>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-3">
              Something interrupted your session
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {friendlyMessage}
            </p>
            {firestoreInfo && (
              <div className="mb-6 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                <div>Operation: {firestoreInfo.operationType}</div>
                {firestoreInfo.path && <div className="mt-1">Path: {firestoreInfo.path}</div>}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
            >
              Reload workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
