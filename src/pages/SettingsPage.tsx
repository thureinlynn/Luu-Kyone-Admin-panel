import React, { useEffect, useState } from 'react';
import {
  Bell,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { DEFAULT_DASHBOARD_SETTINGS } from '../constants/settings';
import type { AdminDashboardSettings } from '../types';

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-900 cursor-pointer"
        >
          {label}
        </label>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { settings, firebaseConnected, saveSettings } = useDashboard();
  const [draft, setDraft] = useState<AdminDashboardSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(draft);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setDraft({
      ...DEFAULT_DASHBOARD_SETTINGS,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Dashboard &amp; Platform Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure operational limits, KYC enforcement, table pagination
            defaults, and admin security policies.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Platform & Table Operations */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <SlidersHorizontal
            className="h-4 w-4 text-indigo-600 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Platform &amp; Table Operations
            </h3>
            <p className="text-xs text-slate-500">
              General console metadata, table density, and luggage weight caps.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="setting-platform-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Platform Display Name
            </label>
            <input
              id="setting-platform-name"
              type="text"
              value={draft.platformName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, platformName: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="setting-support-email"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Operations Support Email
            </label>
            <input
              id="setting-support-email"
              type="email"
              value={draft.supportEmail}
              onChange={(e) =>
                setDraft((d) => ({ ...d, supportEmail: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="setting-page-size"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Default Rows Per Page (Trips &amp; Users)
            </label>
            <select
              id="setting-page-size"
              value={draft.defaultPageSize}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  defaultPageSize: Number(e.target.value) as 10 | 20 | 50,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value={10}>10 rows / page</option>
              <option value={20}>20 rows / page</option>
              <option value={50}>50 rows / page</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="setting-max-weight"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Max Luggage Weight Per Trip (kg)
            </label>
            <input
              id="setting-max-weight"
              type="number"
              min={5}
              max={200}
              value={draft.maxLuggageWeightKg}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                setDraft((d) => ({
                  ...d,
                  maxLuggageWeightKg: Number.isFinite(parsed)
                    ? Math.min(200, Math.max(0, parsed))
                    : 200,
                }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Maximum allowed limit: 200 kg
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <ToggleRow
            id="setting-maintenance-mode"
            label="Maintenance Mode (Pause New Listings)"
            description="Temporarily prevents travelers from posting new cross-border trips while customs or policy updates roll out."
            checked={draft.maintenanceMode}
            onChange={(val) =>
              setDraft((d) => ({ ...d, maintenanceMode: val }))
            }
          />
        </div>
      </section>

      {/* Section 2: Trust, KYC & Moderation Safeguards */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <ShieldCheck
            className="h-4 w-4 text-emerald-600 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Trust, KYC &amp; Moderation Safeguards
            </h3>
            <p className="text-xs text-slate-500">
              Control passport verification gating and automated listing checks.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          <ToggleRow
            id="setting-require-kyc"
            label="Require KYC Verification Before Publishing Trips"
            description="Only travelers with Verified passport/residence status can list spare luggage capacity publicly."
            checked={draft.requireKycForTrips}
            onChange={(val) =>
              setDraft((d) => ({ ...d, requireKycForTrips: val }))
            }
          />
          <ToggleRow
            id="setting-auto-flag-weight"
            label="Auto-Flag High-Weight Luggage Listings"
            description="Automatically send trips exceeding the baggage weight threshold below to the Moderation queue."
            checked={draft.autoFlagHighWeightKg}
            onChange={(val) =>
              setDraft((d) => ({ ...d, autoFlagHighWeightKg: val }))
            }
          />
        </div>

        {draft.autoFlagHighWeightKg && (
          <div className="max-w-xs pt-1">
            <label
              htmlFor="setting-flag-threshold"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Auto-Flag Weight Threshold (kg)
            </label>
            <input
              id="setting-flag-threshold"
              type="number"
              min={10}
              max={200}
              value={draft.highWeightThresholdKg}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                setDraft((d) => ({
                  ...d,
                  highWeightThresholdKg: Number.isFinite(parsed)
                    ? Math.min(200, Math.max(0, parsed))
                    : 25,
                }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        )}
      </section>

      {/* Section 3: Alerts & Session Security */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Bell
            className="h-4 w-4 text-amber-600 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Admin Alerts &amp; Session Security
            </h3>
            <p className="text-xs text-slate-500">
              Notification triggers and console session timeouts for admins.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          <ToggleRow
            id="setting-alert-flagged"
            label="Email Alerts for Flagged Listings"
            description="Notify on-duty operations admins when a corridor listing receives a high-severity report."
            checked={draft.emailAlertsFlagged}
            onChange={(val) =>
              setDraft((d) => ({ ...d, emailAlertsFlagged: val }))
            }
          />
          <ToggleRow
            id="setting-alert-kyc"
            label="Email Alerts for Pending KYC Reviews"
            description="Send a digest alert when travelers submit new passport or residence documents."
            checked={draft.emailAlertsPendingKyc}
            onChange={(val) =>
              setDraft((d) => ({ ...d, emailAlertsPendingKyc: val }))
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
          <div>
            <label
              htmlFor="setting-session-timeout"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Admin Idle Session Timeout
            </label>
            <select
              id="setting-session-timeout"
              value={draft.sessionTimeoutMinutes}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  sessionTimeoutMinutes: Number(e.target.value) as
                    | 30
                    | 60
                    | 120
                    | 480,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Role Guard &amp; Storage
                </p>
                <p className="text-[11px] text-slate-500">
                  {firebaseConnected
                    ? 'Connected to live Firebase project'
                    : 'Local preview persistence'}
                </p>
              </div>
            </div>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
              Active
            </span>
          </div>
        </div>

        {settings.updatedAt && (
          <p className="text-[11px] font-mono text-slate-400">
            Last saved {settings.updatedAt}
            {settings.updatedBy ? ` by ${settings.updatedBy}` : ''}
          </p>
        )}
      </section>
    </form>
  );
}
