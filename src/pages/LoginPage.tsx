import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export function LoginPage() {
  const {
    loginWithEmail,
    loginWithGoogle,
    loginInstantAdmin,
    sendPasswordReset,
    firebaseConnected,
    authLoading,
    authError,
  } = useDashboard();
  const [email, setEmail] = useState('thureinlynn.mm@gmail.com');
  const [password, setPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    setResetError(null);
    await loginWithEmail(email, password);
  };

  const handlePasswordReset = async () => {
    setResetMessage(null);
    setResetError(null);
    setSendingReset(true);
    try {
      await sendPasswordReset(email);
      setResetMessage(
        `Password reset requested for ${email.trim().toLowerCase()}. Firebase only sends an email if this user exists under Authentication → Users and Email/Password sign-in is enabled (also check your spam folder).`,
      );
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : 'Unable to send password reset email.',
      );
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
            <img
              src="/assets/aistudio/1793174899099_3f8af047.png"
              alt="Luu Kyone"
              className="h-full w-full object-contain scale-150"
            />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">
            Luu Kyone
          </span>
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Admin</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="font-display text-xl font-semibold text-slate-900">
              Sign in to Operations Console
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Restricted to verified Luu Kyone team administrators.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800"
            >
              <AlertCircle
                className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{authError}</span>
            </div>
          )}

          {resetError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800"
            >
              <AlertCircle
                className="h-4 w-4 text-red-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{resetError}</span>
            </div>
          )}

          {resetMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-800"
            >
              <CheckCircle2
                className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{resetMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Admin Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="thureinlynn.mm@gmail.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-700"
                >
                  Password
                </label>
                {firebaseConnected && (
                  <button
                    type="button"
                    disabled={sendingReset || authLoading}
                    onClick={handlePasswordReset}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
                  >
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {sendingReset ? 'Sending...' : 'Set / Reset Password'}
                    </span>
                  </button>
                )}
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>{authLoading ? 'Verifying Role...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="mt-5 space-y-2.5">
            <div className="mb-3.5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or quick access</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {firebaseConnected && (
              <button
                type="button"
                disabled={authLoading}
                onClick={() =>
                  void loginWithGoogle(email || 'thureinlynn.mm@gmail.com')
                }
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-left hover:bg-indigo-50 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg
                    className="h-4 w-4 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">
                      Connect Live with Google
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">
                      Real-time trips &amp; users · Super Admin
                    </p>
                  </div>
                </div>
                <span className="rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700 whitespace-nowrap shrink-0">
                  Live DB
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={authLoading}
              onClick={() => void loginInstantAdmin()}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left hover:bg-slate-100 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">
                    Instant Admin Login
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    No account needed · Offline preview
                  </p>
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Role guard: role === &apos;admin&apos;</span>
            <span className="font-mono text-[11px] text-slate-400">
              Firebase Auth + Firestore
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
