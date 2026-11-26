import { useState } from 'react';
import { ArrowRight, CheckSquare, Lock, RefreshCw } from 'lucide-react';

interface SignInViewProps {
  onSignIn: () => Promise<void>;
  isSigningIn: boolean;
  authError: string | null;
}

export function SignInView({ onSignIn, isSigningIn, authError }: SignInViewProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Three-Zone Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Clearlist
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#isolation"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Isolation
            </a>
            <a
              href="#sync"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Real-Time Sync
            </a>
            <a
              href="#workflow"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
            >
              {isSigningIn ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1">
        <section className="max-w-6xl mx-auto px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Column: Primary Focal Anchor */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
                Personal Task Ledger
              </p>
              <h1
                className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.1] mb-5"
                style={{ textWrap: 'balance' }}
              >
                Personal task clarity, synced in real time.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mb-8">
                Sign in with your Google account to manage your personal task list across every open
                tab and device. Each record is strictly isolated to your authenticated identity in
                Cloud Firestore.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting with Google...' : 'Continue with Google'}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                >
                  {authError}
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Google Sign-In</span>
                <span aria-hidden="true">·</span>
                <span>Owner-isolated records</span>
                <span aria-hidden="true">·</span>
                <span>Instant Firestore snapshots</span>
              </div>
            </div>

            {/* Right Column: Editorial Workspace Visual */}
            <div className="lg:col-span-6 flex">
              <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                {!imageError ? (
                  <img
                    src="/src/assets/images/workspace_desk_minimal_1795688730187.jpg"
                    alt="Minimalist architectural workspace desk with open notebook and pen"
                    referrerPolicy="no-referrer"
                    onError={() => setImageError(true)}
                    className="w-full h-72 sm:h-80 lg:h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-72 sm:h-80 lg:h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-8 text-center">
                    <CheckSquare className="w-10 h-10 text-slate-400 mb-3" aria-hidden="true" />
                    <p className="font-display text-base font-medium text-slate-700 dark:text-slate-200">
                      Clearlist Workspace
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Organized, private task management
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grounded Three-Column Architecture Strip */}
          <div className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div id="isolation">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Private by design</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Firestore security rules validate your verified Google UID on every read, query,
                update, and delete operation so other accounts cannot view or alter your tasks.
              </p>
            </div>

            <div id="sync">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Live snapshot synchronization</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Changes propagate immediately across active sessions via Firestore real-time
                listeners—no manual refresh required when adding, completing, or removing items.
              </p>
            </div>

            <div id="workflow">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                <span>Focused daily organization</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Organize items across custom lists, assign clear priorities and due dates, filter by
                completion status, and clear finished work in a single click.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
