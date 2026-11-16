import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Eye,
  EyeOff,
  LogIn,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { AuditLogEntry, CreateAdminAccountInput } from '../types';
import {
  type AdminLogCategoryFilter,
  filterAdminLogs,
  validateAdminAccountForm,
} from '../utils/analytics';
import { Avatar } from '../components/Avatar';
import { StatusBadge } from '../components/StatusBadge';

const LOG_TABS: Array<{ id: AdminLogCategoryFilter; label: string }> = [
  { id: 'all', label: 'All Activity' },
  { id: 'auth', label: 'Logins & Auth' },
  { id: 'admin', label: 'Account Changes' },
  { id: 'operations', label: 'Operations' },
];

const CATEGORY_BADGE_MAP: Record<
  AuditLogEntry['category'],
  { label: string; classes: string }
> = {
  auth: {
    label: 'Login / Auth',
    classes: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  admin: {
    label: 'Admin Account',
    classes: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  trip: {
    label: 'Trip',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  user: {
    label: 'User KYC',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  moderation: {
    label: 'Moderation',
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  announcement: {
    label: 'Broadcast',
    classes: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  settings: {
    label: 'Settings',
    classes: 'border-slate-200 bg-slate-100 text-slate-700',
  },
};

export function AdminAccountsPage() {
  const {
    currentUser,
    users,
    auditLogs,
    createAdminAccount,
    setUserAccountStatus,
  } = useDashboard();

  const [createOpen, setCreateOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CreateAdminAccountInput>({
    name: '',
    email: '',
    handle: '',
    phone: '',
    password: '',
    adminScope: 'Operations Admin',
  });

  const [logFilter, setLogFilter] = useState<AdminLogCategoryFilter>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const adminAccounts = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin');
    if (currentUser && !admins.some((a) => a.id === currentUser.id)) {
      return [currentUser, ...admins];
    }
    return admins;
  }, [users, currentUser]);

  const activeAdminsCount = useMemo(
    () => adminAccounts.filter((a) => a.accountStatus === 'Active').length,
    [adminAccounts],
  );
  const authEventsCount = useMemo(
    () => auditLogs.filter((l) => l.category === 'auth').length,
    [auditLogs],
  );

  const actorNames = useMemo(() => {
    const names = new Set<string>();
    for (const a of adminAccounts) names.add(a.name);
    for (const l of auditLogs) {
      if (l.actorName) names.add(l.actorName);
    }
    return Array.from(names);
  }, [adminAccounts, auditLogs]);

  const filteredLogs = useMemo(
    () => filterAdminLogs(auditLogs, logFilter, actorFilter),
    [auditLogs, logFilter, actorFilter],
  );

  useEffect(() => {
    if (!createOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [createOpen]);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      handle: '',
      phone: '',
      password: '',
      adminScope: 'Operations Admin',
    });
    setErrors({});
    setSubmitError(null);
    setShowPassword(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const validationErrors = validateAdminAccountForm(form, users);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      await createAdminAccount(form);
      resetForm();
      setCreateOpen(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to create admin account.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Administrator Access &amp; Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision verified admin accounts, manage access status, and monitor
            admin logins and operational actions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Create Admin Account</span>
        </button>
      </div>

      <section
        aria-label="Admin account summary metrics"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Total Admin Accounts
            </span>
            <UserCog className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {adminAccounts.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {activeAdminsCount} active ·{' '}
            {adminAccounts.length - activeAdminsCount} suspended
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Admin Login Events
            </span>
            <LogIn className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {authEventsCount}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Recorded sign-ins &amp; sign-outs
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Total Activity Events
            </span>
            <Activity className="h-4 w-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {auditLogs.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Account, trip, KYC &amp; policy logs
          </p>
        </div>
      </section>

      {/* Admin Accounts Directory Table */}
      <section
        aria-labelledby="admin-directory-heading"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3
              id="admin-directory-heading"
              className="font-display text-base font-semibold text-slate-900"
            >
              Admin Accounts Directory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Accounts with <span className="font-mono">role === &apos;admin&apos;</span>{' '}
              permitted to access the Luu Kyone Admin Console.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap shrink-0">
            {adminAccounts.length} accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Administrator</th>
                <th className="px-4 py-3">Email / Contact</th>
                <th className="px-4 py-3">Access Scope</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {adminAccounts.map((admin) => {
                const isSelf = currentUser?.id === admin.id;
                const isSuspended = admin.accountStatus === 'Suspended';
                const isPrimarySuperAdmin =
                  admin.email.toLowerCase() === 'thureinlynn.mm@gmail.com';
                const scopeLabel = isPrimarySuperAdmin
                  ? 'Super Admin'
                  : admin.kycNotes || 'Operations Admin';
                const viewerIsPrimarySuperAdmin =
                  currentUser?.email.toLowerCase() === 'thureinlynn.mm@gmail.com';
                return (
                  <tr
                    key={admin.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={admin.avatarUrl}
                          name={admin.name}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">
                              {admin.name}
                            </span>
                            {isSelf && (
                              <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {admin.handle}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-800">{admin.email}</div>
                      <div className="text-xs font-mono tabular-nums text-slate-500">
                        {admin.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                          scopeLabel === 'Super Admin'
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <ShieldCheck
                          className="h-3.5 w-3.5 text-indigo-600"
                          aria-hidden="true"
                        />
                        <span>{scopeLabel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {admin.joinedAt}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={admin.accountStatus} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isSelf ? (
                        <span className="text-xs text-slate-400">
                          Current session
                        </span>
                      ) : isPrimarySuperAdmin && !viewerIsPrimarySuperAdmin ? (
                        <span className="text-xs font-medium text-indigo-600">
                          Protected Super Admin
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setUserAccountStatus(
                              admin.id,
                              isSuspended ? 'Active' : 'Suspended',
                            )
                          }
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            isSuspended
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {isSuspended ? (
                            <>
                              <RotateCcw
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Reactivate</span>
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Suspend</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin Login & Activity Log Section */}
      <section
        aria-labelledby="admin-activity-log-heading"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3
              id="admin-activity-log-heading"
              className="font-display text-base font-semibold text-slate-900"
            >
              Admin Login &amp; Activity Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological record of admin sign-ins, sign-outs, account
              provisioning, and console actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Filter admin logs by type"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
            >
              {LOG_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={logFilter === t.id}
                  onClick={() => setLogFilter(t.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    logFilter === t.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter log by admin actor"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Admins</option>
              {actorNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-slate-500">
            No login or activity events match the selected filter.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredLogs.slice(0, 30).map((entry) => {
              const badge =
                CATEGORY_BADGE_MAP[entry.category] ||
                CATEGORY_BADGE_MAP.settings;
              return (
                <li
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        entry.category === 'auth'
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                          : entry.category === 'admin'
                            ? 'border-violet-200 bg-violet-50 text-violet-600'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {entry.category === 'auth' ? (
                        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : entry.category === 'admin' ? (
                        <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {entry.action}{' '}
                        <span className="font-normal text-slate-500">
                          — {entry.target}
                        </span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {entry.actorName}
                        </span>
                        {entry.actorEmail && (
                          <span className="font-mono text-[11px] text-slate-400">
                            ({entry.actorEmail})
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap shrink-0 pl-10 sm:pl-0">
                    {entry.timestamp}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Create Admin Account Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-[1px] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-admin-modal-title"
        >
          <div className="flex flex-col w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="create-admin-modal-title"
                    className="font-display text-base font-bold text-slate-900"
                  >
                    Create Admin Account
                  </h2>
                  <p className="text-xs text-slate-500">
                    Provision a new Luu Kyone console administrator.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close create admin modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate>
              <div className="px-5 py-5 space-y-4">
                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="admin-name"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="admin-name"
                      type="text"
                      placeholder="e.g. Aung Kyaw Min"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="admin-handle"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Handle
                    </label>
                    <input
                      id="admin-handle"
                      type="text"
                      placeholder="e.g. @aungkyaw"
                      value={form.handle || ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, handle: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Admin Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    placeholder="name@luukyone.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="admin-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Phone / WhatsApp
                    </label>
                    <input
                      id="admin-phone"
                      type="tel"
                      placeholder="+95 9 123 456 789"
                      value={form.phone || ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-scope"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Access Scope
                    </label>
                    <select
                      id="admin-scope"
                      value={form.adminScope || 'Operations Admin'}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, adminScope: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="Super Admin">Super Admin</option>
                      <option value="Operations Admin">Operations Admin</option>
                      <option value="Trust & KYC">Trust &amp; KYC</option>
                      <option value="Moderation Lead">Moderation Lead</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting ? 'Creating...' : 'Create Admin Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
