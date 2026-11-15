import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export function LoginPage() {
  const { loginWithEmail, loginDemoAdmin, authLoading, authError } =
    useDashboard();
  const [email, setEmail] = useState('admin@luukyone.com');
  const [password, setPassword] = useState('luukyone2026');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithEmail(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-display font-bold text-base">
            LK
          </div>
          <div>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              Luu Kyone Admin
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

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or instant preview</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={authLoading}
            onClick={loginDemoAdmin}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60 transition-colors"
          >
            <ShieldCheck
              className="h-4 w-4 text-indigo-600"
              aria-hidden="true"
            />
            <span>Demo Admin Login</span>
            <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </button>

          <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>Role guard: role === &apos;admin&apos;</span>
            <button
              type="button"
              onClick={() => {
                setEmail('thurein.lynn@mail.com');
                setPassword('traveler123');
              }}
              className="font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
            >
              Test Non-Admin Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
