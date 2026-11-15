import { useMemo } from 'react';
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
  CheckCircle2,
  Clock,
  Package,
  Plane,
  Users,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  computeDashboardKpis,
  computeMonthlyTripVolume,
  computeTopRoutes,
} from '../utils/analytics';
import { TableSkeleton } from '../components/TableSkeleton';

export function OverviewPage() {
  const { trips, users, auditLogs, isLoadingData } = useDashboard();

  const kpis = useMemo(
    () => computeDashboardKpis(trips, users),
    [trips, users],
  );
  const monthlySeries = useMemo(
    () => computeMonthlyTripVolume(trips, new Date('2026-11-15T12:00:00Z'), 6),
    [trips],
  );
  const topRoutes = useMemo(() => computeTopRoutes(trips, 5), [trips]);

  const kpiCards = [
    {
      label: 'Active Trips',
      value: kpis.activeTrips,
      unit: 'routes live',
      icon: Plane,
      tone: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      label: 'Finished Trips',
      value: kpis.finishedTrips,
      unit: 'completed & past',
      icon: CheckCircle2,
      tone: 'text-emerald-600 bg-emerald-50 border-emerald-100',
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
                Active vs. finished trips over the last 6 months
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />
                Active
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                Finished
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
                  name="Finished Trips"
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
          </div>
        </div>
      </section>

      {/* Recent Activity / Audit Log Feed */}
      <section
        aria-labelledby="audit-log-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="audit-log-heading"
              className="font-display text-base font-semibold text-slate-900"
            >
              Recent Activity & Audit Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live ledger of team edits, KYC approvals, and moderation actions
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {auditLogs.length} events
          </span>
        </div>

        <ul className="divide-y divide-slate-200">
          {auditLogs.slice(0, 8).map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm hover:bg-slate-50/60 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {entry.action}{' '}
                  <span className="font-normal text-slate-500">
                    — {entry.target}
                  </span>
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <span>{entry.actorName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{entry.category}</span>
                </div>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                {entry.timestamp}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
