import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessAdminDashboard,
  computeDashboardKpis,
  computeMonthlyTripVolume,
  computeTopRoutes,
  filterAdminLogs,
  filterTrips,
  filterUsers,
  generateNextTripCode,
  getPaginationPageNumbers,
  getUserTripCounts,
  mergeAndSortAuditLogs,
  paginateItems,
  sortTripsNewestFirst,
  upsertById,
  validateAdminAccountForm,
  validateTripForm,
} from './analytics';
import { SEED_AUDIT_LOGS, SEED_TRIPS, SEED_USERS } from '../data/mockData';
import type { TripFormInput } from '../types';

test('canAccessAdminDashboard enforces admin role and active status', () => {
  assert.equal(
    canAccessAdminDashboard({ role: 'admin', accountStatus: 'Active' }),
    true,
  );
  assert.equal(
    canAccessAdminDashboard({ role: 'traveler', accountStatus: 'Active' }),
    false,
  );
  assert.equal(
    canAccessAdminDashboard({ role: 'admin', accountStatus: 'Suspended' }),
    false,
  );
  assert.equal(canAccessAdminDashboard(null), false);
});

test('computeDashboardKpis calculates accurate summary counts and weight', () => {
  const kpis = computeDashboardKpis(SEED_TRIPS, SEED_USERS);
  assert.equal(kpis.activeTrips, 6);
  assert.equal(kpis.finishedTrips, 8);
  assert.equal(kpis.totalUsers, 8);
  assert.equal(kpis.pendingVerifications, 2);
  assert.equal(kpis.totalActiveWeightKg, 112);
});

test('computeMonthlyTripVolume builds 6-month series with Active vs Finished counts', () => {
  const series = computeMonthlyTripVolume(
    SEED_TRIPS,
    new Date('2026-11-15T00:00:00Z'),
    6,
  );
  assert.equal(series.length, 6);
  assert.equal(series[0].monthKey, '2026-06');
  assert.equal(series[5].monthKey, '2026-11');
  const nov = series[5];
  assert.equal(nov.active, 5);
  assert.equal(nov.finished, 2);
});

test('computeTopRoutes ranks corridors by trip volume descending', () => {
  const routes = computeTopRoutes(SEED_TRIPS, 4);
  assert.equal(routes.length, 4);
  assert.equal(routes[0].route, 'Paris → Yangon');
  assert.equal(routes[0].trips, 4);
  assert.equal(routes[1].route, 'Bangkok → Yangon');
  assert.equal(routes[1].trips, 3);
});

test('filterTrips separates active vs finished and filters by query and date range', () => {
  const active = filterTrips(SEED_TRIPS, { tab: 'active', query: '' });
  assert.equal(active.length, 6);

  const finished = filterTrips(SEED_TRIPS, { tab: 'finished', query: '' });
  assert.equal(finished.length, 8);

  const parisActive = filterTrips(SEED_TRIPS, {
    tab: 'active',
    query: 'paris',
  });
  assert.equal(parisActive.length, 2);

  const dateBounded = filterTrips(SEED_TRIPS, {
    tab: 'active',
    query: '',
    startDate: '2026-11-20',
    endDate: '2026-11-28',
  });
  assert.equal(dateBounded.length, 3);
});

test('filterUsers filters by query and verification status', () => {
  const pending = filterUsers(SEED_USERS, '', 'Pending');
  assert.equal(pending.length, 2);

  const searchThurein = filterUsers(SEED_USERS, 'thurein', 'All');
  assert.equal(searchThurein.length, 1);
  assert.equal(searchThurein[0].id, 'usr-01');
});

test('getUserTripCounts tallies active and finished trips per traveler', () => {
  const counts = getUserTripCounts('usr-01', SEED_TRIPS);
  assert.equal(counts.activeCount, 1);
  assert.equal(counts.finishedCount, 2);
});

test('validateTripForm catches missing required fields and invalid dates/numbers', () => {
  const invalid: TripFormInput = {
    travelerId: '',
    originCity: '',
    originCountry: '',
    originCode: '',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-25',
    arrivalDate: '2026-11-20',
    availableWeightKg: 0,
    departureHandoverSpot: '',
    destinationPickupSpot: '',
    acceptedCategories: [],
    status: 'Active',
    notes: '',
    contactChannels: {},
  };
  const errors = validateTripForm(invalid);
  assert.ok(errors.travelerId);
  assert.ok(errors.originCity);
  assert.ok(errors.arrivalDate);
  assert.ok(errors.availableWeightKg);
  assert.ok(errors.notes);
  assert.ok(errors.contactChannels);
});

test('generateNextTripCode increments from highest existing LK code', () => {
  assert.equal(generateNextTripCode(SEED_TRIPS), 'LK-110');
});

test('paginateItems slices 20 items per page and clamps out-of-range pages', () => {
  const rows = Array.from({ length: 45 }, (_, i) => `item-${i + 1}`);

  const page1 = paginateItems(rows, 1, 20);
  assert.equal(page1.items.length, 20);
  assert.equal(page1.items[0], 'item-1');
  assert.equal(page1.items[19], 'item-20');
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 20);

  const page2 = paginateItems(rows, 2, 20);
  assert.equal(page2.items.length, 20);
  assert.equal(page2.items[0], 'item-21');
  assert.equal(page2.startIndex, 21);
  assert.equal(page2.endIndex, 40);

  const page3 = paginateItems(rows, 99, 20);
  assert.equal(page3.page, 3);
  assert.equal(page3.items.length, 5);
  assert.equal(page3.startIndex, 41);
  assert.equal(page3.endIndex, 45);

  const empty = paginateItems([], 2, 20);
  assert.equal(empty.page, 1);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.startIndex, 0);
  assert.equal(empty.endIndex, 0);
});

test('getPaginationPageNumbers handles compact and ellipsis page lists', () => {
  assert.deepEqual(getPaginationPageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(getPaginationPageNumbers(1, 10), [1, 2, 'ellipsis', 10]);
  assert.deepEqual(getPaginationPageNumbers(5, 10), [
    1,
    'ellipsis',
    4,
    5,
    6,
    'ellipsis',
    10,
  ]);
});

test('validateAdminAccountForm validates name, email uniqueness, and password', () => {
  const duplicateErrors = validateAdminAccountForm(
    {
      name: 'A',
      email: 'admin@luukyone.com',
      password: '123',
    },
    SEED_USERS,
  );
  assert.ok(duplicateErrors.name);
  assert.ok(duplicateErrors.email);
  assert.ok(duplicateErrors.password);

  const validErrors = validateAdminAccountForm(
    {
      name: 'Su Myat Ops',
      email: 'ops.lead@luukyone.com',
      password: 'password123',
    },
    SEED_USERS,
  );
  assert.deepEqual(validErrors, {});
});

test('filterAdminLogs filters by auth, admin, operations, and actor', () => {
  const authOnly = filterAdminLogs(SEED_AUDIT_LOGS, 'auth', 'all');
  assert.ok(authOnly.length >= 2);
  assert.ok(authOnly.every((e) => e.category === 'auth'));

  const opsOnly = filterAdminLogs(SEED_AUDIT_LOGS, 'operations', 'all');
  assert.ok(opsOnly.every((e) => e.category !== 'auth' && e.category !== 'admin'));

  const byMissingActor = filterAdminLogs(SEED_AUDIT_LOGS, 'all', 'Nobody');
  assert.equal(byMissingActor.length, 0);
});

test('upsertById deduplicates and updates existing records without duplicates', () => {
  const initial = [
    { id: 't1', label: 'first' },
    { id: 't2', label: 'second' },
  ];
  const inserted = upsertById(initial, { id: 't3', label: 'third' });
  assert.deepEqual(
    inserted.map((i) => i.id),
    ['t3', 't1', 't2'],
  );

  const updated = upsertById(inserted, { id: 't1', label: 'updated-first' });
  assert.equal(updated.length, 3);
  assert.equal(updated.find((i) => i.id === 't1')?.label, 'updated-first');
});

test('sortTripsNewestFirst orders trips by createdAt and departureDate descending', () => {
  const sorted = sortTripsNewestFirst([
    { ...SEED_TRIPS[0], id: 'old', createdAt: '2026-11-01', departureDate: '2026-11-10', tripCode: 'LK-10' },
    { ...SEED_TRIPS[0], id: 'new', createdAt: '2026-11-16', departureDate: '2026-11-20', tripCode: 'LK-11' },
  ]);
  assert.equal(sorted[0].id, 'new');
  assert.equal(sorted[1].id, 'old');
});

test('mergeAndSortAuditLogs deduplicates by id and sorts newest timestamp first', () => {
  const merged = mergeAndSortAuditLogs(
    [
      {
        id: 'log-1',
        actorName: 'Admin',
        actorRole: 'Admin',
        action: 'Signed in',
        target: 'a',
        timestamp: '2026-11-16 09:00',
        category: 'auth',
      },
    ],
    [
      {
        id: 'log-1',
        actorName: 'Admin',
        actorRole: 'Admin',
        action: 'Signed in',
        target: 'a',
        timestamp: '2026-11-16 09:00',
        category: 'auth',
      },
      {
        id: 'log-2',
        actorName: 'Admin',
        actorRole: 'Admin',
        action: 'Created Trip',
        target: 'b',
        timestamp: '2026-11-16 10:30',
        category: 'trip',
      },
    ],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'log-2');
  assert.equal(merged[1].id, 'log-1');
});
