import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export function LoginPage() {
  const {
    loginWithEmail,
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
        `Password setup / reset email sent to ${email.trim().toLowerCase()}. Check your inbox to set your password.`,
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
