import { Link } from 'react-router-dom';
import { ArrowRight, Terminal } from 'lucide-react';
import type { AuditLogEntry } from '../types';
import { getAuditEventTag, type AuditEventTag } from '../utils/analytics';

const TAG_STYLE_MAP: Record<AuditEventTag, string> = {
  LOGIN: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  LOGOUT: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
  CREATE: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300',
  DELETE: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
  'ON/OFF': 'border-violet-500/35 bg-violet-500/10 text-violet-300',
  SETTINGS: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
  UPDATE: 'border-indigo-500/35 bg-indigo-500/10 text-indigo-300',
};

interface TerminalAuditLogProps {
  logs: AuditLogEntry[];
  totalCount?: number;
  title?: string;
  subtitle?: string;
  headingId?: string;
  commandPrompt?: string;
  emptyMessage?: string;
  showViewAllLink?: boolean;
}

export function TerminalAuditLog({
  logs,
  totalCount,
  title = 'Recent Activity & Audit Log',
  subtitle = 'luukyone-admin@ops:~/audit-log',
  headingId,
  commandPrompt = '$ tail -f /var/log/luukyone/admin-audit.log',
  emptyMessage = 'No audit events recorded yet.',
  showViewAllLink = false,
}: TerminalAuditLogProps) {
  const countLabel = totalCount !== undefined ? totalCount : logs.length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-200 shadow-sm">
      {/* Terminal Window Chrome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <Terminal
              className="h-3.5 w-3.5 text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <h2
              id={headingId}
              className="font-mono text-xs sm:text-sm font-semibold text-slate-100 truncate"
            >
              {title}
            </h2>
            <span className="hidden md:inline font-mono text-[11px] text-slate-500 truncate">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {countLabel} {countLabel === 1 ? 'event' : 'events'}
          </span>
          {showViewAllLink && (
            <Link
              to="/audit-logs"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-300 hover:bg-slate-800 hover:text-emerald-200 transition-colors whitespace-nowrap"
            >
              <span>Full Log</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {/* Prompt Line */}
      <div className="border-b border-slate-900 bg-slate-950 px-4 py-2 font-mono text-[11px] text-slate-400 flex items-center justify-between gap-2">
        <span className="truncate">
          <span className="text-emerald-400">admin@luukyone</span>
          <span className="text-slate-500">:</span>
          <span className="text-sky-400">~</span>{' '}
          <span className="text-slate-300">{commandPrompt}</span>
        </span>
        <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
          stdout · utf-8
        </span>
      </div>

      {/* Terminal Log Stream */}
      {logs.length === 0 ? (
        <div className="px-4 py-10 font-mono text-xs text-slate-400">
          <span className="text-amber-400">[INFO]</span> {emptyMessage}
        </div>
      ) : (
        <ul className="divide-y divide-slate-900/90 font-mono text-xs leading-relaxed">
          {logs.map((entry) => {
            const tag = getAuditEventTag(entry);
            const tagClasses = TAG_STYLE_MAP[tag];
            return (
              <li
                key={entry.id}
                className="flex flex-col lg:flex-row lg:items-baseline justify-between gap-1.5 lg:gap-4 px-4 py-2.5 hover:bg-slate-900/60 transition-colors"
              >
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 min-w-0">
                  <span className="text-slate-500 tabular-nums shrink-0">
                    [{entry.timestamp || '----'}]
                  </span>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shrink-0 ${tagClasses}`}
                  >
                    {tag}
                  </span>
                  <span className="text-emerald-300 font-semibold shrink-0">
                    {entry.actorName || 'Admin'}
                  </span>
                  {entry.actorEmail && (
                    <span className="text-slate-400 text-[11px] shrink-0">
                      &lt;{entry.actorEmail}&gt;
                    </span>
                  )}
                  <span className="text-slate-100">{entry.action}</span>
                  {entry.target && (
                    <span className="text-slate-400 break-words">
                      — {entry.target}
                    </span>
                  )}
                </div>

                <span className="text-[11px] uppercase tracking-wider text-slate-500 whitespace-nowrap shrink-0">
                  [{entry.category}]
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Terminal Tail Cursor */}
      <div className="border-t border-slate-900 bg-slate-950/95 px-4 py-2 font-mono text-[11px] text-slate-500 flex items-center gap-2">
        <span className="text-emerald-400">$</span>
        <span>listening for live admin events</span>
        <span
          className="inline-block h-3.5 w-1.5 bg-emerald-400/80 animate-pulse"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
