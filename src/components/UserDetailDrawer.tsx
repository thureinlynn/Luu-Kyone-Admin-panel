import { useEffect } from 'react';
import {
  Ban,
  CheckCircle2,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import type {
  AccountStatus,
  Trip,
  UserProfile,
  VerificationStatus,
} from '../types';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

interface UserDetailDrawerProps {
  user: UserProfile | null;
  trips: Trip[];
  onClose: () => void;
  onUpdateVerification: (
    userId: string,
    status: VerificationStatus,
  ) => Promise<void>;
  onToggleAccountStatus: (
    userId: string,
    status: AccountStatus,
  ) => Promise<void>;
}

export function UserDetailDrawer({
  user,
  trips,
  onClose,
  onUpdateVerification,
  onToggleAccountStatus,
}: UserDetailDrawerProps) {
  useEffect(() => {
    if (!user) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [user, onClose]);

  if (!user) return null;

  const userTrips = trips.filter((t) => t.travelerId === user.id);
  const activeTrips = userTrips.filter((t) => t.status === 'Active');
  const finishedTrips = userTrips.filter(
    (t) => t.status === 'Completed' || t.status === 'Cancelled',
  );

  const isSuspended = user.accountStatus === 'Suspended';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-drawer-title"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <Avatar src={user.avatarUrl} name={user.name} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="user-drawer-title"
                  className="text-lg font-semibold text-slate-900 truncate"
                >
                  {user.name}
                </h2>
                <StatusBadge value={user.verificationStatus} />
                <StatusBadge value={user.accountStatus} />
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="font-mono">{user.handle}</span>
                <span aria-hidden="true">·</span>
                <span>{user.nationality}</span>
                <span aria-hidden="true">·</span>
                <span>Joined {user.joinedAt}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user detail drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Contact & Identity Summary */}
          <section aria-labelledby="profile-contact-heading">
            <h3
              id="profile-contact-heading"
              className="text-xs font-semibold text-slate-500 mb-3"
            >
              Profile & Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Email Address</span>
                </div>
                <p className="mt-1 font-medium text-slate-900 break-all">
                  {user.email}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Phone / WhatsApp</span>
                </div>
                <p className="mt-1 font-mono tabular-nums text-slate-900">
                  {user.phone}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Passport / ID</span>
                <p className="mt-1 font-mono tabular-nums text-slate-900">
                  {user.passportLast4
                    ? `•••• ${user.passportLast4}`
                    : 'Not submitted'}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">
                  Policy Warnings
                </span>
                <p className="mt-1 font-mono tabular-nums text-slate-900">
                  {user.warningsCount} recorded
                </p>
              </div>
            </div>
          </section>

          {/* KYC Verification & Moderation Controls */}
          <section aria-labelledby="kyc-moderation-heading">
            <h3
              id="kyc-moderation-heading"
              className="text-xs font-semibold text-slate-500 mb-3"
            >
              KYC Review & Account Moderation
            </h3>
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Passport & Identity Verification
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {user.kycNotes ||
                      (user.kycSubmittedAt
                        ? `Submitted on ${user.kycSubmittedAt}`
                        : 'No KYC dossier uploaded by user yet.')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={user.verificationStatus === 'Verified'}
                    onClick={() => onUpdateVerification(user.id, 'Verified')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Approve KYC</span>
                  </button>
                  <button
                    type="button"
                    disabled={user.verificationStatus === 'Unverified'}
                    onClick={() => onUpdateVerification(user.id, 'Unverified')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Account Access Control
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSuspended
                      ? 'Account is currently suspended and cannot publish new trips.'
                      : 'Account is active and permitted to list luggage capacity.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onToggleAccountStatus(
                      user.id,
                      isSuspended ? 'Active' : 'Suspended',
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isSuspended
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {isSuspended ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reactivate User</span>
                    </>
                  ) : (
                    <>
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Suspend User</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Sub-Table 1: User's Active Trips */}
          <section aria-labelledby="drawer-active-trips-heading">
            <div className="flex items-center justify-between mb-3">
              <h3
                id="drawer-active-trips-heading"
                className="text-xs font-semibold text-slate-500"
              >
                User&apos;s Active Trips ({activeTrips.length})
              </h3>
            </div>
            {activeTrips.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
                No active trips currently listed by {user.name}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-3.5 py-2.5">Trip ID</th>
                      <th className="px-3.5 py-2.5">Route</th>
                      <th className="px-3.5 py-2.5">Last Drop-Off</th>
                      <th className="px-3.5 py-2.5">Delivery</th>
                      <th className="px-3.5 py-2.5 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {activeTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                          #{trip.tripCode}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                          {trip.originCity} ({trip.originCode}) →{' '}
                          {trip.destinationCity} ({trip.destinationCode})
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {trip.departureDate}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {trip.arrivalDate}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {trip.availableWeightKg} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sub-Table 2: User's Finished Trips */}
          <section aria-labelledby="drawer-finished-trips-heading">
            <div className="flex items-center justify-between mb-3">
              <h3
                id="drawer-finished-trips-heading"
                className="text-xs font-semibold text-slate-500"
              >
                User&apos;s Finished Trips ({finishedTrips.length})
              </h3>
            </div>
            {finishedTrips.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-xs text-slate-500">
                No completed or past trips on record for {user.name}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-3.5 py-2.5">Trip ID</th>
                      <th className="px-3.5 py-2.5">Route</th>
                      <th className="px-3.5 py-2.5">Completed Date</th>
                      <th className="px-3.5 py-2.5 text-right">
                        Weight Carried
                      </th>
                      <th className="px-3.5 py-2.5">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {finishedTrips.map((trip) => (
                      <tr key={trip.id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-mono font-medium text-slate-900 whitespace-nowrap">
                          #{trip.tripCode}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                          {trip.originCity} → {trip.destinationCity}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {trip.completedDate || trip.arrivalDate}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          {trip.carriedWeightKg ?? trip.availableWeightKg} kg
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                            {trip.status === 'Completed' && (
                              <CheckCircle2
                                className="h-3.5 w-3.5 text-emerald-600"
                                aria-hidden="true"
                              />
                            )}
                            <span>{trip.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
