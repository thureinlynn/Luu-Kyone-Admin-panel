import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Clock,
  Pencil,
  Plane,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { Trip, TripFormInput } from '../types';
import {
  filterTrips,
  getEffectiveTripStatus,
  paginateItems,
} from '../utils/analytics';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { TablePagination } from '../components/TablePagination';
import { TableSkeleton } from '../components/TableSkeleton';
import { TripFormModal } from '../components/TripFormModal';

interface TripsPageProps {
  onOpenCreateModal: () => void;
}

interface TripListSectionProps {
  headingId: string;
  title: string;
  subtitle: string;
  trips: Trip[];
  totalTripsCount: number;
  page: number;
  pageSize: number;
  itemLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  hasFilters: boolean;
  tone: 'active' | 'expired';
  onPageChange: (nextPage: number) => void;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onClearFilters: () => void;
  onOpenCreateModal: () => void;
}

function TripListSection({
  headingId,
  title,
  subtitle,
  trips,
  totalTripsCount,
  page,
  pageSize,
  itemLabel,
  emptyTitle,
  emptyDescription,
  hasFilters,
  tone,
  onPageChange,
  onEdit,
  onDelete,
  onClearFilters,
  onOpenCreateModal,
}: TripListSectionProps) {
  const paginated = useMemo(
    () => paginateItems(trips, page, pageSize),
    [trips, page, pageSize],
  );

  const Icon = tone === 'active' ? Plane : Clock;

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
              tone === 'active'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-slate-100 text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id={headingId}
                className="font-display text-base font-semibold text-slate-900"
              >
                {title}
              </h2>
              <span
                className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                  tone === 'active'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 bg-slate-100 text-slate-700'
                }`}
              >
                {trips.length}
                {hasFilters && trips.length !== totalTripsCount
                  ? ` / ${totalTripsCount}`
                  : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Table or Empty State */}
      {trips.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Icon}
            title={hasFilters ? `No matching ${itemLabel}` : emptyTitle}
            description={
              hasFilters
                ? 'Try clearing your search query or widening the drop-off date range.'
                : emptyDescription
            }
            actionLabel={
              hasFilters
                ? 'Reset Filters'
                : tone === 'active'
                  ? 'Create Trip'
                  : undefined
            }
            onAction={
              hasFilters
                ? onClearFilters
                : tone === 'active'
                  ? onOpenCreateModal
                  : undefined
            }
          />
        </div>
      ) : (
        <>
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
                {paginated.items.map((trip) => {
                  const effectiveStatus = getEffectiveTripStatus(trip);
                  return (
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
                        <StatusBadge value={effectiveStatus} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(trip)}
                            aria-label={`Edit Trip #${trip.tripCode}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(trip)}
                            aria-label={`Delete Trip #${trip.tripCode}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={paginated.page}
            totalPages={paginated.totalPages}
            totalItems={paginated.totalItems}
            startIndex={paginated.startIndex}
            endIndex={paginated.endIndex}
            itemLabel={itemLabel}
            onPageChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}

export function TripsPage({ onOpenCreateModal }: TripsPageProps) {
  const { trips, users, settings, isLoadingData, editTrip, removeTrip } =
    useDashboard();
  const pageSize = settings.defaultPageSize || 20;

  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [expiredPage, setExpiredPage] = useState(1);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);

  const totalActiveCount = useMemo(
    () =>
      filterTrips(trips, {
        tab: 'active',
        query: '',
      }).length,
    [trips],
  );
  const totalExpiredCount = useMemo(
    () =>
      filterTrips(trips, {
        tab: 'expired',
        query: '',
      }).length,
    [trips],
  );

  const activeTrips = useMemo(
    () =>
      filterTrips(trips, {
        tab: 'active',
        query,
        startDate,
        endDate,
      }),
    [trips, query, startDate, endDate],
  );

  const expiredTrips = useMemo(
    () =>
      filterTrips(trips, {
        tab: 'expired',
        query,
        startDate,
        endDate,
      }),
    [trips, query, startDate, endDate],
  );

  const hasFilters = Boolean(query || startDate || endDate);

  const clearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setActivePage(1);
    setExpiredPage(1);
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
    <div className="space-y-6">
      {/* Summary Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-700">Active Trips:</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {totalActiveCount}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="font-medium text-slate-700">Expired Trips:</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {totalExpiredCount}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
            <span className="font-medium text-slate-700">Total Trips:</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {trips.length}
            </span>
          </div>
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
                  setActivePage(1);
                  setExpiredPage(1);
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
                setActivePage(1);
                setExpiredPage(1);
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
                setActivePage(1);
                setExpiredPage(1);
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

      {/* Separated Lists: Active Trips & Expired Trips */}
      {isLoadingData ? (
        <div className="space-y-6">
          <TableSkeleton rows={5} columns={8} />
          <TableSkeleton rows={5} columns={8} />
        </div>
      ) : (
        <div className="space-y-6">
          <TripListSection
            headingId="active-trips-list-heading"
            title="Active Trips"
            subtitle="Upcoming and open luggage capacity listings (drop-off date today or later)."
            trips={activeTrips}
            totalTripsCount={totalActiveCount}
            page={activePage}
            pageSize={pageSize}
            itemLabel="active trips"
            emptyTitle="No active trips listed"
            emptyDescription="Create a new corridor listing to connect travelers with senders."
            hasFilters={hasFilters}
            tone="active"
            onPageChange={setActivePage}
            onEdit={setEditingTrip}
            onDelete={setDeletingTrip}
            onClearFilters={clearFilters}
            onOpenCreateModal={onOpenCreateModal}
          />

          <TripListSection
            headingId="expired-trips-list-heading"
            title="Expired Trips"
            subtitle="Past-date trips (before today), completed deliveries, and cancelled listings."
            trips={expiredTrips}
            totalTripsCount={totalExpiredCount}
            page={expiredPage}
            pageSize={pageSize}
            itemLabel="expired trips"
            emptyTitle="No expired trips recorded"
            emptyDescription="Past trips dated before today or closed trips will appear here."
            hasFilters={hasFilters}
            tone="expired"
            onPageChange={setExpiredPage}
            onEdit={setEditingTrip}
            onDelete={setDeletingTrip}
            onClearFilters={clearFilters}
            onOpenCreateModal={onOpenCreateModal}
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
