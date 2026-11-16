import type {
  AuditLogEntry,
  CreateAdminAccountInput,
  DashboardKpis,
  MonthlyTripVolumePoint,
  RouteVolumePoint,
  Trip,
  TripFormInput,
  UserProfile,
} from '../types';

export function canAccessAdminDashboard(
  user: Pick<UserProfile, 'role' | 'accountStatus'> | null | undefined,
): boolean {
  if (!user) return false;
  return user.role === 'admin' && user.accountStatus === 'Active';
}

export function computeDashboardKpis(
  trips: Trip[],
  users: UserProfile[],
): DashboardKpis {
  const activeTripsList = trips.filter((t) => t.status === 'Active');
  const finishedTrips = trips.filter(
    (t) => t.status === 'Completed' || t.status === 'Cancelled',
  ).length;
  const pendingVerifications = users.filter(
    (u) => u.verificationStatus === 'Pending',
  ).length;
  const totalActiveWeightKg = activeTripsList.reduce(
    (sum, trip) => sum + (Number(trip.availableWeightKg) || 0),
    0,
  );

  return {
    activeTrips: activeTripsList.length,
    finishedTrips,
    totalUsers: users.length,
    pendingVerifications,
    totalActiveWeightKg: Math.round(totalActiveWeightKg * 10) / 10,
  };
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function computeMonthlyTripVolume(
  trips: Trip[],
  referenceDate: Date = new Date('2026-11-15T12:00:00Z'),
  monthsCount: number = 6,
): MonthlyTripVolumePoint[] {
  const buckets: MonthlyTripVolumePoint[] = [];
  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(refYear, refMonth - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    buckets.push({
      monthKey,
      label: `${MONTH_NAMES[month]} '${String(year).slice(-2)}`,
      active: 0,
      finished: 0,
    });
  }

  const bucketMap = new Map(buckets.map((b) => [b.monthKey, b]));

  for (const trip of trips) {
    const dateStr = trip.departureDate || trip.createdAt;
    const key = dateStr.slice(0, 7);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    if (trip.status === 'Active') {
      bucket.active += 1;
    } else {
      bucket.finished += 1;
    }
  }

  return buckets;
}

export function computeTopRoutes(
  trips: Trip[],
  limit: number = 5,
): RouteVolumePoint[] {
  const routeMap = new Map<string, { trips: number; weightKg: number }>();

  for (const trip of trips) {
    const route = `${trip.originCity} → ${trip.destinationCity}`;
    const existing = routeMap.get(route) ?? { trips: 0, weightKg: 0 };
    existing.trips += 1;
    existing.weightKg +=
      trip.status === 'Completed'
        ? (trip.carriedWeightKg ?? trip.availableWeightKg)
        : trip.availableWeightKg;
    routeMap.set(route, existing);
  }

  return Array.from(routeMap.entries())
    .map(([route, stats]) => ({
      route,
      trips: stats.trips,
      weightKg: Math.round(stats.weightKg * 10) / 10,
    }))
    .sort((a, b) => b.trips - a.trips || b.weightKg - a.weightKg)
    .slice(0, limit);
}

export interface TripFilterOptions {
  tab: 'active' | 'finished';
  query: string;
  startDate?: string;
  endDate?: string;
}

export function filterTrips(
  trips: Trip[],
  options: TripFilterOptions,
): Trip[] {
  const q = options.query.trim().toLowerCase();

  return trips.filter((trip) => {
    const isTabMatch =
      options.tab === 'active'
        ? trip.status === 'Active'
        : trip.status === 'Completed' || trip.status === 'Cancelled';

    if (!isTabMatch) return false;

    if (q) {
      const haystack = [
        trip.tripCode,
        trip.travelerName,
        trip.originCity,
        trip.originCountry,
        trip.originCode,
        trip.destinationCity,
        trip.destinationCountry,
        trip.destinationCode,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (options.startDate && trip.departureDate < options.startDate) {
      return false;
    }
    if (options.endDate && trip.departureDate > options.endDate) {
      return false;
    }

    return true;
  });
}

export function filterUsers(
  users: UserProfile[],
  query: string,
  verificationFilter: 'All' | UserProfile['verificationStatus'] = 'All',
): UserProfile[] {
  const q = query.trim().toLowerCase();

  return users.filter((u) => {
    if (
      verificationFilter !== 'All' &&
      u.verificationStatus !== verificationFilter
    ) {
      return false;
    }
    if (!q) return true;
    return [u.name, u.handle, u.email, u.phone]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
}

export function getUserTripCounts(
  userId: string,
  trips: Trip[],
): { activeCount: number; finishedCount: number } {
  let activeCount = 0;
  let finishedCount = 0;
  for (const t of trips) {
    if (t.travelerId !== userId) continue;
    if (t.status === 'Active') activeCount += 1;
    else finishedCount += 1;
  }
  return { activeCount, finishedCount };
}

export function deriveAirportCode(city: string, explicitCode?: string): string {
  const cleaned = (explicitCode || '').trim().toUpperCase();
  if (cleaned) return cleaned.slice(0, 5);

  const cityMap: Record<string, string> = {
    yangon: 'RGN',
    bangkok: 'BKK',
    singapore: 'SIN',
    paris: 'CDG',
    tokyo: 'NRT',
    london: 'LHR',
    'kuala lumpur': 'KUL',
    seoul: 'ICN',
    mandalay: 'MDL',
    'chiang mai': 'CNX',
    dubai: 'DXB',
  };
  const key = city.trim().toLowerCase();
  if (cityMap[key]) return cityMap[key];
  return city.trim().replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'INT';
}

export function validateTripForm(input: TripFormInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.travelerId.trim()) {
    errors.travelerId = 'Select a traveler profile.';
  }
  if (!input.originCity.trim()) {
    errors.originCity = 'Departure city is required.';
  }
  if (!input.destinationCity.trim()) {
    errors.destinationCity = 'Arrival city is required.';
  }
  if (!input.departureDate) {
    errors.departureDate = 'Last drop-off date is required.';
  }
  if (!input.arrivalDate) {
    errors.arrivalDate = 'Check-out / delivery date is required.';
  } else if (input.departureDate && input.arrivalDate < input.departureDate) {
    errors.arrivalDate =
      'Check-out / delivery date must be on or after drop-off date.';
  }
  if (!Number.isFinite(input.availableWeightKg) || input.availableWeightKg <= 0) {
    errors.availableWeightKg = 'Available luggage weight must be greater than 0 kg.';
  }
  if (!input.notes || input.notes.trim().length < 10) {
    errors.notes =
      'Trip announcement & information notice is required (min 10 characters).';
  }
  const hasContactChannel = Boolean(
    input.contactChannels.whatsapp?.trim() ||
      input.contactChannels.telegram?.trim() ||
      input.contactChannels.facebook?.trim() ||
      input.contactChannels.viber?.trim(),
  );
  if (!hasContactChannel) {
    errors.contactChannels =
      'Provide at least one direct contact channel (WhatsApp, Telegram, Facebook, or Viber).';
  }

  return errors;
}

export function generateNextTripCode(trips: Trip[]): string {
  let maxNum = 100;
  for (const t of trips) {
    const match = t.tripCode.match(/LK-(\d+)/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `LK-${maxNum + 1}`;
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  pageSize: number = 20,
): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), totalPages);

  if (totalItems === 0) {
    return {
      items: [],
      page: 1,
      pageSize: safePageSize,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    };
  }

  const offset = (page - 1) * safePageSize;
  const sliced = items.slice(offset, offset + safePageSize);
  return {
    items: sliced,
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex: offset + 1,
    endIndex: offset + sliced.length,
  };
}

export function getPaginationPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) {
    pages.push('ellipsis');
  }

  for (let p = left; p <= right; p += 1) {
    pages.push(p);
  }

  if (right < totalPages - 1) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);
  return pages;
}

export function validateAdminAccountForm(
  input: CreateAdminAccountInput,
  existingUsers: Pick<UserProfile, 'email'>[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!trimmedName || trimmedName.length < 2) {
    errors.name = 'Full name is required (at least 2 characters).';
  }

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = 'Enter a valid admin email address.';
  } else if (
    existingUsers.some((u) => u.email.trim().toLowerCase() === normalizedEmail)
  ) {
    errors.email = 'An account with this email already exists.';
  }

  if (!input.password || input.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return errors;
}

export type AdminLogCategoryFilter = 'all' | 'auth' | 'admin' | 'operations';

export function filterAdminLogs(
  logs: AuditLogEntry[],
  categoryFilter: AdminLogCategoryFilter,
  actorFilter: string = 'all',
): AuditLogEntry[] {
  return logs.filter((entry) => {
    if (
      actorFilter !== 'all' &&
      entry.actorName.toLowerCase() !== actorFilter.toLowerCase()
    ) {
      return false;
    }

    if (categoryFilter === 'auth') return entry.category === 'auth';
    if (categoryFilter === 'admin') return entry.category === 'admin';
    if (categoryFilter === 'operations') {
      return (
        entry.category === 'trip' ||
        entry.category === 'user' ||
        entry.category === 'moderation' ||
        entry.category === 'announcement' ||
        entry.category === 'settings'
      );
    }
    return true;
  });
}

export function upsertById<T extends { id: string }>(
  items: T[],
  item: T,
  prepend: boolean = true,
): T[] {
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  if (existingIndex === -1) {
    return prepend ? [item, ...items] : [...items, item];
  }
  const next = items.slice();
  next[existingIndex] = item;
  return next;
}

export function sortTripsNewestFirst(trips: Trip[]): Trip[] {
  return trips.slice().sort((a, b) => {
    const createdCmp = (b.createdAt || '').localeCompare(a.createdAt || '');
    if (createdCmp !== 0) return createdCmp;
    const depCmp = (b.departureDate || '').localeCompare(a.departureDate || '');
    if (depCmp !== 0) return depCmp;
    return (b.tripCode || '').localeCompare(a.tripCode || '');
  });
}

export function mergeAndSortAuditLogs(
  existing: AuditLogEntry[],
  incoming: AuditLogEntry[],
): AuditLogEntry[] {
  const map = new Map<string, AuditLogEntry>();
  for (const item of existing) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || ''),
  );
}

