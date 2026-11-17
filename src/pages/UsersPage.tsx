import { useMemo, useState } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { VerificationStatus } from '../types';
import {
  filterUsers,
  getUserTripCounts,
  paginateItems,
} from '../utils/analytics';
import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { TablePagination } from '../components/TablePagination';
import { TableSkeleton } from '../components/TableSkeleton';
import { UserDetailDrawer } from '../components/UserDetailDrawer';

const VERIFICATION_FILTERS: Array<'All' | VerificationStatus> = [
  'All',
  'Verified',
  'Pending',
  'Unverified',
];

export function UsersPage() {
  const {
    users,
    trips,
    settings,
    isLoadingData,
    setUserVerification,
    setUserAccountStatus,
  } = useDashboard();
  const pageSize = settings.defaultPageSize || 20;

  const [query, setQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<
    'All' | VerificationStatus
  >('All');
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(
    () => filterUsers(users, query, verificationFilter),
    [users, query, verificationFilter],
  );

  const paginatedUsers = useMemo(
    () => paginateItems(filteredUsers, page, pageSize),
    [filteredUsers, page, pageSize],
  );

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  return (
    <div className="space-y-5">
      {/* Search & Verification Segmented Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search users by name, handle, email, or phone"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, @handle, email, or phone..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 self-start md:self-auto">
          {VERIFICATION_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setVerificationFilter(status);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                verificationFilter === status
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      {isLoadingData ? (
        <TableSkeleton rows={6} columns={7} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No matching user profiles"
          description="Adjust your search term or verification status filter to view Luu Kyone members."
          actionLabel="Reset Filters"
          onAction={() => {
            setQuery('');
            setVerificationFilter('All');
            setPage(1);
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email / Contact</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3 text-right">Active Trips</th>
                  <th className="px-4 py-3 text-right">Finished Trips</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginatedUsers.items.map((user) => {
                  const counts = getUserTripCounts(user.id, trips);
                  return (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={user.avatarUrl}
                            name={user.name}
                            size="sm"
                          />
                          <div>
                            <div className="font-medium text-slate-900">
                              {user.name}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              {user.handle} · {user.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{user.email}</div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {user.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge value={user.verificationStatus} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums font-medium text-slate-900 whitespace-nowrap">
                        {counts.activeCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {counts.finishedCount}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge value={user.accountStatus} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserId(user.id);
                          }}
                          aria-label={`Inspect ${user.name}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors whitespace-nowrap"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={paginatedUsers.page}
            totalPages={paginatedUsers.totalPages}
            totalItems={paginatedUsers.totalItems}
            startIndex={paginatedUsers.startIndex}
            endIndex={paginatedUsers.endIndex}
            itemLabel="users"
            onPageChange={setPage}
          />
        </div>
      )}

      {/* User Detail Slide-Over Drawer */}
      <UserDetailDrawer
        user={selectedUser}
        trips={trips}
        onClose={() => setSelectedUserId(null)}
        onUpdateVerification={setUserVerification}
        onToggleAccountStatus={setUserAccountStatus}
      />
    </div>
  );
}
