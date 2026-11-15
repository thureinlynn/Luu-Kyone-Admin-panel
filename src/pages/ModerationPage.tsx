import React, { useState } from 'react';
import {
  Check,
  Megaphone,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { AnnouncementSeverity, FlaggedContent } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';

export function ModerationPage() {
  const {
    flaggedItems,
    announcements,
    dismissFlag,
    removeListingAndWarn,
    addAnnouncement,
    toggleAnnouncement,
    removeAnnouncement,
  } = useDashboard();

  const [flagToWarn, setFlagToWarn] = useState<FlaggedContent | null>(null);

  const [title, setTitle] = useState('');
  const [corridor, setCorridor] = useState('All International → RGN');
  const [severity, setSeverity] = useState<AnnouncementSeverity>('Info');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openFlags = flaggedItems.filter((f) => f.status === 'Open');
  const resolvedFlags = flaggedItems.filter((f) => f.status !== 'Open');
  const activeAnnouncements = announcements.filter((a) => a.isActive);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFormError('Title and broadcast message are required.');
      return;
    }
    setFormError(null);
    await addAnnouncement({
      title: title.trim(),
      corridor: corridor.trim() || 'All Corridors',
      severity,
      message: message.trim(),
      isActive: true,
    });
    setTitle('');
    setMessage('');
    setSeverity('Info');
  };

  return (
    <div className="space-y-8">
      {/* Live App Banner Preview */}
      {activeAnnouncements.length > 0 && (
        <section aria-label="Live System Banner Preview">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2.5 text-sm text-indigo-950">
              <Megaphone
                className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0"
                aria-hidden="true"
              />
              <div>
                <span className="font-semibold">
                  Live in Luu Kyone App ({activeAnnouncements.length} active):
                </span>{' '}
                <span className="text-indigo-900">
                  {activeAnnouncements[0].title} —{' '}
                  {activeAnnouncements[0].message}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-indigo-700 whitespace-nowrap shrink-0">
              {activeAnnouncements[0].corridor}
            </span>
          </div>
        </section>
      )}

      {/* Section 1: Flagged Content Queue */}
      <section aria-labelledby="flagged-queue-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2
              id="flagged-queue-heading"
              className="font-display text-base font-semibold text-slate-900"
            >
              Flagged Content Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review reported trip listings and enforce customs or baggage safety rules
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {openFlags.length} open
          </span>
        </div>

        {openFlags.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="All flagged reports resolved"
            description="No pending trip reports require moderation right now."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
            {openFlags.map((flag) => (
              <div
                key={flag.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      #{flag.tripCode}
                    </span>
                    <StatusBadge value={flag.severity} />
                    <span className="text-sm font-medium text-slate-900">
                      {flag.reason}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{flag.details}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span>Traveler: {flag.travelerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{flag.routeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Reported by {flag.reportedBy}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {flag.reportedAt}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => dismissFlag(flag.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Dismiss</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlagToWarn(flag)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Remove Listing &amp; Warn User</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolvedFlags.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-3">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Recently Resolved ({resolvedFlags.length})
            </p>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {resolvedFlags.map((flag) => (
                <li
                  key={flag.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    <span className="font-mono font-medium text-slate-800">
                      #{flag.tripCode}
                    </span>{' '}
                    — {flag.reason} ({flag.travelerName})
                  </span>
                  <StatusBadge value={flag.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Section 2: Broadcast Announcement Manager */}
      <section
        aria-labelledby="announcements-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Create Announcement Form */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 self-start">
          <h2
            id="announcements-heading"
            className="font-display text-base font-semibold text-slate-900"
          >
            Broadcast Announcement
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Publish customs notices or airline baggage alerts to the Luu Kyone app
          </p>

          <form onSubmit={handleCreateAnnouncement} className="space-y-4">
            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {formError}
              </p>
            )}
            <div>
              <label
                htmlFor="ann-title"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Banner Headline
              </label>
              <input
                id="ann-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. RGN Customs Holiday Schedule"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ann-corridor"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Target Corridor
                </label>
                <input
                  id="ann-corridor"
                  type="text"
                  value={corridor}
                  onChange={(e) => setCorridor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="ann-severity"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Priority Level
                </label>
                <select
                  id="ann-severity"
                  value={severity}
                  onChange={(e) =>
                    setSeverity(e.target.value as AnnouncementSeverity)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Info">Info</option>
                  <option value="Warning">Warning</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ann-message"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Banner Message
              </label>
              <textarea
                id="ann-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write clear instructions for travelers and senders..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Publish Active Banner
            </button>
          </form>
        </div>

        {/* Announcements List */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              System-Wide Banners ({announcements.length})
            </h3>
            <span className="text-xs text-slate-500">
              Toggle active state immediately
            </span>
          </div>
          {announcements.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No broadcast banners created yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {announcements.map((ann) => (
                <li
                  key={ann.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge value={ann.severity} />
                      <h4 className="text-sm font-semibold text-slate-900">
                        {ann.title}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600">{ann.message}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{ann.corridor}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {ann.createdAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ann.isActive}
                      aria-label={`Toggle banner "${ann.title}"`}
                      onClick={() => toggleAnnouncement(ann.id, !ann.isActive)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        ann.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span>{ann.isActive ? 'Active' : 'Paused'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAnnouncement(ann.id)}
                      aria-label={`Delete banner "${ann.title}"`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Safe Confirmation for Removing Flagged Listing */}
      <ConfirmDialog
        open={Boolean(flagToWarn)}
        title={`Remove Trip #${flagToWarn?.tripCode ?? ''} & Warn User?`}
        description={`This will cancel Trip #${flagToWarn?.tripCode ?? ''} (${flagToWarn?.routeLabel ?? ''}) and record an official policy warning on ${flagToWarn?.travelerName ?? ''}'s account.`}
        confirmLabel="Remove Listing & Warn"
        tone="danger"
        onCancel={() => setFlagToWarn(null)}
        onConfirm={async () => {
          if (!flagToWarn) return;
          await removeListingAndWarn(flagToWarn.id);
          setFlagToWarn(null);
        }}
      />
    </div>
  );
}
