import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Clock,
  History,
  Megaphone,
  Package,
  Plane,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { AnnouncementSeverity } from '../types';
import {
  computeDashboardKpis,
  computeMonthlyTripVolume,
  computeTopRoutes,
} from '../utils/analytics';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/TableSkeleton';
import { TerminalAuditLog } from '../components/TerminalAuditLog';

export function OverviewPage() {
  const {
    trips,
    users,
    announcements,
    auditLogs,
    isLoadingData,
    dataError,
    addAnnouncement,
    toggleAnnouncement,
    removeAnnouncement,
  } = useDashboard();

  const [composerOpen, setComposerOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annCorridor, setAnnCorridor] = useState('All Corridors');
  const [annSeverity, setAnnSeverity] = useState<AnnouncementSeverity>('Info');
  const [annMessage, setAnnMessage] = useState('');
  const [annError, setAnnError] = useState<string | null>(null);
  const [annSubmitting, setAnnSubmitting] = useState(false);

  const kpis = useMemo(
    () => computeDashboardKpis(trips, users),
    [trips, users],
  );
  const monthlySeries = useMemo(
    () => computeMonthlyTripVolume(trips, new Date(), 6),
    [trips],
  );
  const topRoutes = useMemo(() => computeTopRoutes(trips, 5), [trips]);

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) {
      setAnnError('Title and message are required.');
      return;
    }
    setAnnError(null);
    setAnnSubmitting(true);
    try {
      await addAnnouncement({
        title: annTitle.trim(),
        corridor: annCorridor.trim() || 'All Corridors',
        severity: annSeverity,
        message: annMessage.trim(),
        isActive: true,
      });
      setAnnTitle('');
      setAnnMessage('');
      setAnnSeverity('Info');
      setComposerOpen(false);
    } catch (err) {
      setAnnError(
        err instanceof Error ? err.message : 'Unable to publish announcement.',
      );
    } finally {
      setAnnSubmitting(false);
    }
  };

  const kpiCards = [
    {
      label: 'Active Trips',
      value: kpis.activeTrips,
      unit: 'routes active',
      icon: Plane,
      tone: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      label: 'Expired Trips',
      value: kpis.finishedTrips,
      unit: 'past & completed',
      icon: History,
      tone: 'text-slate-700 bg-slate-100 border-slate-200',
    },
    {
      label: 'Registered Users',
      value: kpis.totalUsers,
      unit: 'travelers & senders',
      icon: Users,
      tone: 'text-slate-700 bg-slate-100 border-slate-200',
    },
    {
      label: 'Pending Verifications',
      value: kpis.pendingVerifications,
      unit: 'awaiting KYC review',
      icon: Clock,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
    },
    {
      label: 'Listed Weight',
      value: `${kpis.totalActiveWeightKg}`,
      unit: 'kg active capacity',
      icon: Package,
      tone: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
  ];

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
            >
              <div className="h-3.5 w-24 rounded bg-slate-200 mb-4" />
              <div className="h-7 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dataError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          Firestore sync error: {dataError}
        </div>
      )}

      {/* KPI Summary Cards */}
      <section aria-label="Key Performance Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    {card.label}
                  </span>
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${card.tone}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {card.value}
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {card.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Data Visualizations */}
      <section
        aria-label="Corridor and Monthly Volume Analytics"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Monthly Trip Volume */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Monthly Trip Volume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active vs. expired trips over the last 6 months
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                Active
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                Expired
              </span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlySeries}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="active"
                  name="Active Trips"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
                <Bar
                  dataKey="finished"
                  name="Expired Trips"
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Popular Routes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Top Popular Routes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Highest-traffic cross-border corridors by total trips
              </p>
            </div>
            <Link
              to="/trips"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap"
            >
              <span>All Trips</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="h-72 w-full">
            {topRoutes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No corridor trips recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRoutes}
                  layout="vertical"
                  margin={{ top: 8, right: 20, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="route"
                    width={168}
                    tick={{ fontSize: 12, fill: '#334155' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="trips"
                    name="Total Trips"
                    fill="#4f46e5"
                    radius={[0, 4, 4, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Broadcast Announcements (Live Firestore Collection) */}
      <section
        aria-labelledby="announcements-section-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Megaphone
              className="h-4 w-4 text-indigo-600 shrink-0"
              aria-hidden="true"
            />
            <div>
              <h2
                id="announcements-section-heading"
                className="font-display text-base font-semibold text-slate-900"
              >
                System Announcements
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time corridor advisories synced to Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
            <span>{composerOpen ? 'Close Composer' : 'New Announcement'}</span>
          </button>
        </div>

        {composerOpen && (
          <form
            onSubmit={handlePublishAnnouncement}
            className="border-b border-slate-200 bg-slate-50/70 p-5 space-y-3"
          >
            {annError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {annError}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="ov-ann-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Headline
                </label>
                <input
                  id="ov-ann-title"
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="e.g. RGN Customs Notice"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label
                  htmlFor="ov-ann-corridor"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Corridor
                </label>
                <input
                  id="ov-ann-corridor"
                  type="text"
                  value={annCorridor}
                  onChange={(e) => setAnnCorridor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label
                  htmlFor="ov-ann-severity"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Severity
                </label>
                <select
                  id="ov-ann-severity"
                  value={annSeverity}
                  onChange={(e) =>
                    setAnnSeverity(e.target.value as AnnouncementSeverity)
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
                htmlFor="ov-ann-message"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Message
              </label>
              <textarea
                id="ov-ann-message"
                rows={2}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Write corridor notice for Luu Kyone travelers and senders..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={annSubmitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {annSubmitting ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        )}

        {announcements.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No announcements published in Firestore yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {announcements.map((ann) => (
              <li
                key={ann.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge value={ann.severity} />
                    <span className="text-sm font-medium text-slate-900">
                      {ann.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      · {ann.corridor}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{ann.message}</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ann.isActive}
                    aria-label={`Toggle announcement "${ann.title}"`}
                    onClick={() => void toggleAnnouncement(ann.id, !ann.isActive)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      ann.isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {ann.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAnnouncement(ann.id)}
                    aria-label={`Delete announcement "${ann.title}"`}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Activity / Audit Log Feed (Terminal Theme) */}
      <section aria-labelledby="audit-log-heading">
        <TerminalAuditLog
          logs={auditLogs.slice(0, 10)}
          totalCount={auditLogs.length}
          headingId="audit-log-heading"
          title="Recent Activity & Audit Log"
          subtitle="luukyone-admin@ops:~/audit-log"
          commandPrompt="$ tail -n 10 /var/log/luukyone/admin-audit.log"
          showViewAllLink
        />
      </section>
    </div>
  );
}
