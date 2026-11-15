import React, { useState } from 'react';
import { AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export function LoginPage() {
  const { loginWithEmail, authLoading, authError } = useDashboard();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithEmail(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
            <img
              src="/assets/aistudio/1793174899099_3f8af047.png"
              alt="Luu Kyone"
              className="h-full w-full object-contain scale-150"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              Luu Kyone
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 whitespace-nowrap">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Admin</span>
            </span>
          </div>
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
                placeholder="admin@luukyone.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
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
        </div>
      </div>
    </div>
  );
}

