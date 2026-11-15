import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {
  AccountStatus,
  AnnouncementSeverity,
  FlagSeverity,
  FlagStatus,
  TripStatus,
  VerificationStatus,
} from '../types';

type StatusValue =
  | TripStatus
  | VerificationStatus
  | AccountStatus
  | FlagSeverity
  | FlagStatus
  | AnnouncementSeverity;

export function StatusBadge({ value }: { value: StatusValue }) {
  switch (value) {
    case 'Active':
    case 'Verified':
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{value}</span>
        </span>
      );
    case 'Pending':
    case 'Warning':
    case 'Medium':
    case 'Open':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 whitespace-nowrap shrink-0">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{value}</span>
        </span>
      );
    case 'Suspended':
    case 'Cancelled':
    case 'Critical':
    case 'High':
    case 'Removed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap shrink-0">
          {value === 'Suspended' ? (
            <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : value === 'Cancelled' || value === 'Removed' ? (
            <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{value}</span>
        </span>
      );
    case 'Info':
    case 'Low':
    case 'Dismissed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{value}</span>
        </span>
      );
    case 'Unverified':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{value}</span>
        </span>
      );
  }
}
