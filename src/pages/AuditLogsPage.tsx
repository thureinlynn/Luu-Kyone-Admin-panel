import { useMemo, useState } from 'react';
import {
  LogIn,
  LogOut,
  PlusSquare,
  Power,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import {
  filterActivityAuditLogs,
  getAuditEventTag,
  paginateItems,
  type AuditActivityFilter,
} from '../utils/analytics';
import { TablePagination } from '../components/TablePagination';
import { TerminalAuditLog } from '../components/TerminalAuditLog';

const ACTIVITY_FILTERS: Array<{
  id: AuditActivityFilter;
  label: string;
}> = [
  { id: 'all', label: 'All Events' },
  { id: 'login', label: 'Login' },
  { id: 'logout', label: 'Logout' },
  { id: 'create', label: 'Create' },
  { id: 'delete', label: 'Delete' },
  { id: 'toggle', label: 'On / Off' },
  { id: 'settings', label: 'Settings' },
];

export function AuditLogsPage() {
  const { auditLogs, users, settings } = useDashboard();
  const pageSize = settings.defaultPageSize || 20;

  const [actionFilter, setActionFilter] = useState<AuditActivityFilter>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const actorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const u of users) {
      if (u.role === 'admin' && u.name) names.add(u.name);
    }
    for (const log of auditLogs) {
      if (log.actorName) names.add(log.actorName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [auditLogs, users]);

  const tagCounts = useMemo(() => {
    const counts = {
      login: 0,
      logout: 0,
      create: 0,
      delete: 0,
      toggle: 0,
      settings: 0,
    };
    for (const entry of auditLogs) {
      const tag = getAuditEventTag(entry);
      if (tag === 'LOGIN') counts.login += 1;
      else if (tag === 'LOGOUT') counts.logout += 1;
      else if (tag === 'CREATE') counts.create += 1;
      else if (tag === 'DELETE') counts.delete += 1;
      else if (tag === 'ON/OFF') counts.toggle += 1;
      else if (tag === 'SETTINGS') counts.settings += 1;
    }
    return counts;
  }, [auditLogs]);

  const filteredLogs = useMemo(
    () =>
      filterActivityAuditLogs(auditLogs, {
        actionFilter,
        actorFilter,
        query,
      }),
    [auditLogs, actionFilter, actorFilter, query],
  );

  const paginatedLogs = useMemo(
    () => paginateItems(filteredLogs, page, pageSize),
    [filteredLogs, page, pageSize],
  );

  const hasFilters =
    actionFilter !== 'all' || actorFilter !== 'all' || Boolean(query);

  const clearFilters = () => {
    setActionFilter('all');
    setActorFilter('all');
    setQuery('');
    setPage(1);
  };

  const commandPrompt = useMemo(() => {
    const parts = ['$ grep -E'];
    if (actionFilter === 'all') {
      parts.push('"LOGIN|LOGOUT|CREATE|DELETE|ON/OFF|SETTINGS"');
    } else if (actionFilter === 'toggle') {
      parts.push('"ON/OFF"');
    } else {
      parts.push(`"${actionFilter.toUpperCase()}"`);
    }
    if (actorFilter !== 'all') {
      parts.push(`--actor="${actorFilter}"`);
    }
    if (query.trim()) {
      parts.push(`--query="${query.trim()}"`);
    }
    parts.push('/var/log/luukyone/admin-audit.log');
    return parts.join(' ');
  }, [actionFilter, actorFilter, query]);

  const summaryCards = [
    {
      label: 'Admin Logins',
      value: tagCounts.login,
      icon: LogIn,
      filterId: 'login' as AuditActivityFilter,
      tone: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      label: 'Admin Logouts',
      value: tagCounts.logout,
      icon: LogOut,
      filterId: 'logout' as AuditActivityFilter,
      tone: 'text-amber-700 bg-amber-50 border-amber-100',
    },
    {
      label: 'Creates',
      value: tagCounts.create,
      icon: PlusSquare,
      filterId: 'create' as AuditActivityFilter,
      tone: 'text-cyan-700 bg-cyan-50 border-cyan-100',
    },
    {
      label: 'Deletes',
      value: tagCounts.delete,
      icon: Trash2,
      filterId: 'delete' as AuditActivityFilter,
      tone: 'text-rose-700 bg-rose-50 border-rose-100',
    },
    {
      label: 'On / Off Toggles',
      value: tagCounts.toggle,
      icon: Power,
      filterId: 'toggle' as AuditActivityFilter,
      tone: 'text-violet-700 bg-violet-50 border-violet-100',
    },
    {
      label: 'Setting Changes',
      value: tagCounts.settings,
      icon: SlidersHorizontal,
      filterId: 'settings' as AuditActivityFilter,
      tone: 'text-sky-700 bg-sky-50 border-sky-100',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Quick Event Counters */}
      <section aria-label="Audit Event Counters">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            const selected = actionFilter === card.filterId;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => {
                  setActionFilter(selected ? 'all' : card.filterId);
                  setPage(1);
                }}
                className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    {card.label}
                  </span>
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${card.tone}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </div>
                <span className="mt-2 font-display text-xl font-bold text-slate-900 tabular-nums">
                  {card.value}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter terminal audit log by action type"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 self-start"
          >
            {ACTIVITY_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={actionFilter === item.id}
                onClick={() => {
                  setActionFilter(item.id);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  actionFilter === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search terminal audit logs"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search admin, action, target..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <select
              aria-label="Filter audit logs by admin user"
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Admin Users</option>
              {actorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Audit Log Output */}
      <section aria-labelledby="full-audit-log-heading" className="space-y-3">
        <TerminalAuditLog
          logs={paginatedLogs.items}
          totalCount={filteredLogs.length}
          headingId="full-audit-log-heading"
          title="Recent Activity & Audit Log"
          subtitle="luukyone-admin@ops:/var/log/audit"
          commandPrompt={commandPrompt}
          emptyMessage="No terminal log events match your current filters."
        />

        {filteredLogs.length > pageSize && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <TablePagination
              page={paginatedLogs.page}
              totalPages={paginatedLogs.totalPages}
              totalItems={paginatedLogs.totalItems}
              startIndex={paginatedLogs.startIndex}
              endIndex={paginatedLogs.endIndex}
              itemLabel="events"
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
