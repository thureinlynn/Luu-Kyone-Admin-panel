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
import type {
  AuditLogEntry,
  Trip,
  TripFormInput,
  UserProfile,
} from '../types';

const TEST_USERS: UserProfile[] = [
  {
    id: 'usr-admin-01',
    uid: 'admin-1',
    name: 'Khin Sandi Oo',
    handle: '@khinsandi',
    email: 'admin@luukyone.com',
    phone: '+95 9 4210 88210',
    role: 'admin',
    verificationStatus: 'Verified',
    accountStatus: 'Active',
    joinedAt: '2025-02-10',
    nationality: 'Myanmar',
    warningsCount: 0,
  },
  {
    id: 'usr-01',
    uid: 'uid-thurein-lynn',
    name: 'Thurein Lynn',
    handle: '@thurein',
    email: 'thurein.lynn@mail.com',
    phone: '+33 6 82 41 19 04',
    role: 'traveler',
    verificationStatus: 'Verified',
    accountStatus: 'Active',
    joinedAt: '2025-08-14',
    nationality: 'Myanmar',
    warningsCount: 0,
  },
  {
    id: 'usr-02',
    uid: 'uid-may-thu-aung',
    name: 'May Thu Aung',
    handle: '@maythu',
    email: 'maythu.aung@sgmail.com',
    phone: '+65 9182 4401',
    role: 'traveler',
    verificationStatus: 'Pending',
    accountStatus: 'Active',
    joinedAt: '2025-09-03',
    nationality: 'Myanmar',
    warningsCount: 0,
  },
  {
    id: 'usr-03',
    uid: 'uid-htet-wai-yan',
    name: 'Htet Wai Yan',
    handle: '@htetwai',
    email: 'htetwai.bkk@gmail.com',
    phone: '+66 84 992 1034',
    role: 'traveler',
    verificationStatus: 'Pending',
    accountStatus: 'Active',
    joinedAt: '2026-10-28',
    nationality: 'Myanmar',
    warningsCount: 0,
  },
  {
    id: 'usr-04',
    uid: 'uid-nang-hmwe-hom',
    name: 'Nang Hmwe Hom',
    handle: '@nanghmwe',
    email: 'nanghmwe.uk@outlook.com',
    phone: '+44 7700 900412',
    role: 'sender',
    verificationStatus: 'Unverified',
    accountStatus: 'Active',
    joinedAt: '2026-11-09',
    nationality: 'Myanmar',
    warningsCount: 0,
  },
];

const TEST_TRIPS: Trip[] = [
  {
    id: 'trip-109',
    tripCode: 'LK-109',
    travelerId: 'usr-01',
    travelerName: 'Thurein Lynn',
    travelerVerified: true,
    originCity: 'Paris',
    originCountry: 'France',
    originCode: 'CDG',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-22',
    arrivalDate: '2026-11-23',
    availableWeightKg: 18,
    acceptedCategories: ['Urgent Documents & Letters'],
    status: 'Active',
    notes: 'CDG to RGN carry-on space.',
    contactChannels: { whatsapp: '+33 6 82 41 19 04' },
    createdAt: '2026-11-10',
  },
  {
    id: 'trip-108',
    tripCode: 'LK-108',
    travelerId: 'usr-02',
    travelerName: 'May Thu Aung',
    travelerVerified: false,
    originCity: 'Paris',
    originCountry: 'France',
    originCode: 'CDG',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-26',
    arrivalDate: '2026-11-27',
    availableWeightKg: 12,
    acceptedCategories: ['Cosmetics & Personal Care'],
    status: 'Active',
    notes: 'Direct handoff in Yangon.',
    contactChannels: { whatsapp: '+65 9182 4401' },
    createdAt: '2026-11-11',
  },
  {
    id: 'trip-107',
    tripCode: 'LK-107',
    travelerId: 'usr-03',
    travelerName: 'Htet Wai Yan',
    travelerVerified: false,
    originCity: 'Bangkok',
    originCountry: 'Thailand',
    originCode: 'BKK',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-25',
    arrivalDate: '2026-11-25',
    availableWeightKg: 23,
    acceptedCategories: ['Clothing & Fashion Goods'],
    status: 'Active',
    notes: 'BTS Asok drop-off.',
    contactChannels: { whatsapp: '+66 84 992 1034' },
    createdAt: '2026-11-12',
  },
  {
    id: 'trip-106',
    tripCode: 'LK-106',
    travelerId: 'usr-01',
    travelerName: 'Thurein Lynn',
    travelerVerified: true,
    originCity: 'Paris',
    originCountry: 'France',
    originCode: 'CDG',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-04',
    arrivalDate: '2026-11-05',
    completedDate: '2026-11-05',
    availableWeightKg: 15,
    carriedWeightKg: 15,
    acceptedCategories: ['Urgent Documents & Letters'],
    status: 'Completed',
    notes: 'Completed smoothly.',
    contactChannels: { whatsapp: '+33 6 82 41 19 04' },
    createdAt: '2026-10-28',
  },
  {
    id: 'trip-105',
    tripCode: 'LK-105',
    travelerId: 'usr-01',
    travelerName: 'Thurein Lynn',
    travelerVerified: true,
    originCity: 'Bangkok',
    originCountry: 'Thailand',
    originCode: 'BKK',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-11-08',
    arrivalDate: '2026-11-08',
    completedDate: '2026-11-08',
    availableWeightKg: 10,
    carriedWeightKg: 10,
    acceptedCategories: ['Urgent Documents & Letters'],
    status: 'Completed',
    notes: 'Completed on time.',
    contactChannels: { whatsapp: '+33 6 82 41 19 04' },
    createdAt: '2026-11-01',
  },
  {
    id: 'trip-104',
    tripCode: 'LK-104',
    travelerId: 'usr-02',
    travelerName: 'May Thu Aung',
    travelerVerified: false,
    originCity: 'Singapore',
    originCountry: 'Singapore',
    originCode: 'SIN',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-09-12',
    arrivalDate: '2026-09-12',
    availableWeightKg: 14,
    carriedWeightKg: 0,
    acceptedCategories: ['Electronics & Tech Accessories'],
    status: 'Cancelled',
    notes: 'Flight rescheduled.',
    contactChannels: { whatsapp: '+65 9182 4401' },
    createdAt: '2026-09-01',
  },
];

const TEST_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-auth-01',
    actorName: 'Khin Sandi Oo',
    actorEmail: 'admin@luukyone.com',
    actorRole: 'Admin',
    action: 'Admin account signed in',
    target: 'Authenticated via email',
    timestamp: '2026-11-15 03:10',
    category: 'auth',
  },
  {
    id: 'log-01',
    actorName: 'Khin Sandi Oo',
    actorEmail: 'admin@luukyone.com',
    actorRole: 'Admin',
    action: 'Edited Trip #LK-109',
    target: 'Updated CDG → RGN',
    timestamp: '2026-11-15 02:18',
    category: 'trip',
  },
  {
    id: 'log-auth-02',
    actorName: 'Khin Sandi Oo',
    actorEmail: 'admin@luukyone.com',
    actorRole: 'Admin',
    action: 'Admin account signed in',
    target: 'Authenticated via Google',
    timestamp: '2026-11-14 09:02',
    category: 'auth',
  },
];

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
  const kpis = computeDashboardKpis(TEST_TRIPS, TEST_USERS);
  assert.equal(kpis.activeTrips, 3);
  assert.equal(kpis.finishedTrips, 3);
  assert.equal(kpis.totalUsers, 5);
  assert.equal(kpis.pendingVerifications, 2);
  assert.equal(kpis.totalActiveWeightKg, 53);
});

test('computeMonthlyTripVolume builds 6-month series with Active vs Finished counts', () => {
  const series = computeMonthlyTripVolume(
    TEST_TRIPS,
    new Date('2026-11-15T00:00:00Z'),
    6,
  );
  assert.equal(series.length, 6);
  assert.equal(series[0].monthKey, '2026-06');
  assert.equal(series[5].monthKey, '2026-11');
  const nov = series[5];
  assert.equal(nov.active, 3);
  assert.equal(nov.finished, 2);
});

test('computeTopRoutes ranks corridors by trip volume descending', () => {
  const routes = computeTopRoutes(TEST_TRIPS, 4);
  assert.equal(routes.length, 3);
  assert.equal(routes[0].route, 'Paris → Yangon');
  assert.equal(routes[0].trips, 3);
  assert.equal(routes[1].route, 'Bangkok → Yangon');
  assert.equal(routes[1].trips, 2);
});

test('filterTrips separates active vs finished and filters by query and date range', () => {
  const active = filterTrips(TEST_TRIPS, { tab: 'active', query: '' });
  assert.equal(active.length, 3);

  const finished = filterTrips(TEST_TRIPS, { tab: 'finished', query: '' });
  assert.equal(finished.length, 3);

  const parisActive = filterTrips(TEST_TRIPS, {
    tab: 'active',
    query: 'paris',
  });
  assert.equal(parisActive.length, 2);

  const dateBounded = filterTrips(TEST_TRIPS, {
    tab: 'active',
    query: '',
    startDate: '2026-11-24',
    endDate: '2026-11-28',
  });
  assert.equal(dateBounded.length, 2);
});

test('filterUsers filters by query and verification status', () => {
  const pending = filterUsers(TEST_USERS, '', 'Pending');
  assert.equal(pending.length, 2);

  const searchThurein = filterUsers(TEST_USERS, 'thurein', 'All');
  assert.equal(searchThurein.length, 1);
  assert.equal(searchThurein[0].id, 'usr-01');
});

test('getUserTripCounts tallies active and finished trips per traveler', () => {
  const counts = getUserTripCounts('usr-01', TEST_TRIPS);
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
  assert.equal(generateNextTripCode(TEST_TRIPS), 'LK-110');
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
    TEST_USERS,
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
    TEST_USERS,
  );
  assert.deepEqual(validErrors, {});
});

test('filterAdminLogs filters by auth, admin, operations, and actor', () => {
  const authOnly = filterAdminLogs(TEST_AUDIT_LOGS, 'auth', 'all');
  assert.ok(authOnly.length >= 2);
  assert.ok(authOnly.every((e) => e.category === 'auth'));

  const opsOnly = filterAdminLogs(TEST_AUDIT_LOGS, 'operations', 'all');
  assert.ok(opsOnly.every((e) => e.category !== 'auth' && e.category !== 'admin'));

  const byMissingActor = filterAdminLogs(TEST_AUDIT_LOGS, 'all', 'Nobody');
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
    {
      ...TEST_TRIPS[0],
      id: 'old',
      createdAt: '2026-11-01',
      departureDate: '2026-11-10',
      tripCode: 'LK-10',
    },
    {
      ...TEST_TRIPS[0],
      id: 'new',
      createdAt: '2026-11-16',
      departureDate: '2026-11-20',
      tripCode: 'LK-11',
    },
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
