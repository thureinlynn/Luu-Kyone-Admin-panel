import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Pencil,
  Plane,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { Trip, TripFormInput } from '../types';
import { filterTrips, paginateItems } from '../utils/analytics';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { TablePagination } from '../components/TablePagination';
import { TableSkeleton } from '../components/TableSkeleton';
import { TripFormModal } from '../components/TripFormModal';

const PAGE_SIZE = 20;

interface TripsPageProps {
  onOpenCreateModal: () => void;
}

export function TripsPage({ onOpenCreateModal }: TripsPageProps) {
  const { trips, users, isLoadingData, editTrip, removeTrip } = useDashboard();

  const [tab, setTab] = useState<'active' | 'finished'>('active');
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);

  const activeCount = useMemo(
    () => trips.filter((t) => t.status === 'Active').length,
    [trips],
  );
  const finishedCount = useMemo(
    () =>
      trips.filter(
        (t) => t.status === 'Completed' || t.status === 'Cancelled',
      ).length,
    [trips],
  );

  const filteredTrips = useMemo(
    () => filterTrips(trips, { tab, query, startDate, endDate }),
    [trips, tab, query, startDate, endDate],
  );

  const paginatedTrips = useMemo(
    () => paginateItems(filteredTrips, page, PAGE_SIZE),
    [filteredTrips, page],
  );

  const hasFilters = Boolean(query || startDate || endDate);

  const clearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleEditSubmit = async (input: TripFormInput) => {
    if (!editingTrip) return;
    await editTrip(editingTrip.id, input);
    setEditingTrip(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTrip) return;
    await removeTrip(deletingTrip.id);
    setDeletingTrip(null);
  };

  return (
    <div className="space-y-5">
      {/* Segmented Tabs & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Trip status tabs"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'active'}
            onClick={() => {
              setTab('active');
              setPage(1);
            }}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Trips{' '}
            <span className="ml-1 font-mono tabular-nums text-slate-500">
              ({activeCount})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'finished'}
            onClick={() => {
              setTab('finished');
              setPage(1);
            }}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'finished'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Finished / Past Trips{' '}
            <span className="ml-1 font-mono tabular-nums text-slate-500">
              ({finishedCount})
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
          <span>Post Trip for Traveler</span>
        </button>
      </div>

      {/* Search & Date Range Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label
              htmlFor="trips-search"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Search Trips
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="trips-search"
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Trip ID, traveler, Paris, Yangon..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="trips-date-from"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Drop-Off From
            </label>
            <input
              id="trips-date-from"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="trips-date-to"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Drop-Off To
            </label>
            <input
              id="trips-date-to"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="md:col-span-1 flex justify-end">
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                aria-label="Clear trip filters"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      {isLoadingData ? (
        <TableSkeleton rows={6} columns={8} />
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          icon={Plane}
          title={
            hasFilters
              ? 'No trips match your filters'
              : tab === 'active'
                ? 'No active trips listed'
                : 'No finished trips recorded'
          }
          description={
            hasFilters
              ? 'Try clearing your search query or widening the departure date range.'
              : 'Create a new corridor listing to connect travelers with senders.'
          }
          actionLabel={hasFilters ? 'Reset Filters' : 'Create Trip'}
          onAction={hasFilters ? clearFilters : onOpenCreateModal}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">Trip ID</th>
                  <th className="px-4 py-3">Traveler</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Last Drop-Off</th>
                  <th className="px-4 py-3">Delivery Date</th>
                  <th className="px-4 py-3 text-right">Weight</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginatedTrips.items.map((trip) => (
                  <tr
                    key={trip.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      #{trip.tripCode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          src={trip.travelerAvatarUrl}
                          name={trip.travelerName}
                          size="sm"
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900">
                            {trip.travelerName}
                          </span>
                          {trip.travelerVerified && (
                            <BadgeCheck
                              className="h-4 w-4 text-indigo-600 shrink-0"
                              aria-label="Verified traveler"
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {trip.originCity} → {trip.destinationCity}
                      </div>
                      <div className="text-xs font-mono text-slate-500">
                        {trip.originCode} / {trip.destinationCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {trip.departureDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {trip.arrivalDate}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {trip.availableWeightKg} kg
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge value={trip.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTrip(trip)}
                          aria-label={`Edit Trip #${trip.tripCode}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTrip(trip)}
                          aria-label={`Delete Trip #${trip.tripCode}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={paginatedTrips.page}
            totalPages={paginatedTrips.totalPages}
            totalItems={paginatedTrips.totalItems}
            startIndex={paginatedTrips.startIndex}
            endIndex={paginatedTrips.endIndex}
            itemLabel="trips"
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Edit Trip Modal */}
      <TripFormModal
        open={Boolean(editingTrip)}
        editingTrip={editingTrip}
        users={users}
        onClose={() => setEditingTrip(null)}
        onSubmit={handleEditSubmit}
      />

      {/* Safe Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingTrip)}
        title={`Delete Trip #${deletingTrip?.tripCode ?? ''}?`}
        description={`This will permanently remove ${deletingTrip?.originCity ?? ''} → ${deletingTrip?.destinationCity ?? ''} (${deletingTrip?.travelerName ?? ''}) from the Luu Kyone ledger.`}
        confirmLabel="Delete Trip"
        tone="danger"
        onCancel={() => setDeletingTrip(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
