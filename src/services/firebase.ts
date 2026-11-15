import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DEFAULT_DASHBOARD_SETTINGS } from '../constants/settings';
import type {
  AccountStatus,
  AdminDashboardSettings,
  Announcement,
  AnnouncementSeverity,
  AuditLogEntry,
  ContactChannels,
  CreateAdminAccountInput,
  ItemCategory,
  Trip,
  TripStatus,
  UserProfile,
  VerificationStatus,
} from '../types';
import { canAccessAdminDashboard, deriveAirportCode } from '../utils/analytics';

export const app =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const COLLECTIONS = {
  USERS: 'users',
  TRIPS: 'trips',
  ANNOUNCEMENTS: 'announcements',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
} as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

// ---------------------------------------------------------------------------
// Luu Kyone Firestore Document Normalization & Serialization
// ---------------------------------------------------------------------------

function normalizeTripStatus(rawStatus: unknown): TripStatus {
  const s = String(rawStatus || 'active').toLowerCase();
  if (s === 'completed' || s === 'finished' || s === 'done') return 'Completed';
  if (s === 'cancelled' || s === 'canceled' || s === 'removed') {
    return 'Cancelled';
  }
  return 'Active';
}

function normalizeDateString(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.slice(0, 10);
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
  return '';
}

function normalizeContacts(raw: unknown): ContactChannels {
  if (!raw || typeof raw !== 'object') return {};
  const c = raw as Record<string, unknown>;
  return {
    whatsapp: typeof c.whatsapp === 'string' && c.whatsapp ? c.whatsapp : undefined,
    telegram: typeof c.telegram === 'string' && c.telegram ? c.telegram : undefined,
    facebook: typeof c.facebook === 'string' && c.facebook ? c.facebook : undefined,
    viber: typeof c.viber === 'string' && c.viber ? c.viber : undefined,
  };
}

function extractPlaceString(
  rawPlace: unknown,
  fallbackCity: unknown,
  fallbackAltCity: unknown,
): string {
  if (typeof fallbackCity === 'string' && fallbackCity.trim()) {
    return fallbackCity.trim();
  }
  if (typeof fallbackAltCity === 'string' && fallbackAltCity.trim()) {
    return fallbackAltCity.trim();
  }
  if (typeof rawPlace === 'string' && rawPlace.trim()) {
    return rawPlace.trim();
  }
  if (rawPlace && typeof rawPlace === 'object' && 'city' in rawPlace) {
    const city = (rawPlace as Record<string, unknown>).city;
    if (typeof city === 'string' && city.trim()) return city.trim();
  }
  return 'Unknown';
}

export function normalizeFirestoreUser(
  docId: string,
  raw: Record<string, unknown>,
): UserProfile {
  const email = typeof raw.email === 'string' ? raw.email : '';
  const name =
    (typeof raw.displayName === 'string' && raw.displayName.trim()) ||
    (typeof raw.name === 'string' && raw.name.trim()) ||
    (email ? email.split('@')[0] : 'Luu Kyone User');

  const avatarUrl =
    (typeof raw.photoURL === 'string' && raw.photoURL) ||
    (typeof raw.avatarUrl === 'string' && raw.avatarUrl) ||
    undefined;

  const contacts = normalizeContacts(raw.contacts);
  const phone =
    (typeof raw.phone === 'string' && raw.phone) ||
    contacts.whatsapp ||
    contacts.viber ||
    'Not provided';

  const handle =
    (typeof raw.handle === 'string' && raw.handle) ||
    (contacts.telegram
      ? contacts.telegram.startsWith('@')
        ? contacts.telegram
        : `@${contacts.telegram}`
      : `@${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user'}`);

  let verificationStatus: VerificationStatus = 'Unverified';
  if (
    raw.verificationStatus === 'Verified' ||
    raw.verificationStatus === 'Pending' ||
    raw.verificationStatus === 'Unverified'
  ) {
    verificationStatus = raw.verificationStatus;
  } else if (raw.isVerified === true) {
    verificationStatus = 'Verified';
  }

  const accountStatus: AccountStatus =
    raw.accountStatus === 'Suspended' || raw.isSuspended === true
      ? 'Suspended'
      : 'Active';

  const role =
    raw.role === 'admin' || raw.role === 'sender' || raw.role === 'traveler'
      ? raw.role
      : 'traveler';

  return {
    id: docId,
    uid: typeof raw.uid === 'string' && raw.uid ? raw.uid : docId,
    name,
    handle,
    email,
    phone,
    role,
    avatarUrl,
    verificationStatus,
    accountStatus,
    joinedAt:
      normalizeDateString(raw.createdAt) ||
      normalizeDateString(raw.joinedAt) ||
      (typeof raw.memberSince === 'string' ? raw.memberSince : ''),
    nationality:
      typeof raw.nationality === 'string' && raw.nationality
        ? raw.nationality
        : 'International',
    passportLast4:
      typeof raw.passportLast4 === 'string' ? raw.passportLast4 : undefined,
    kycSubmittedAt:
      typeof raw.kycSubmittedAt === 'string' ? raw.kycSubmittedAt : undefined,
    kycNotes:
      (typeof raw.kycNotes === 'string' && raw.kycNotes) ||
      (typeof raw.bio === 'string' ? raw.bio : undefined),
    warningsCount: typeof raw.warningsCount === 'number' ? raw.warningsCount : 0,
  };
}

export interface RawFirestoreDoc {
  id: string;
  data: Record<string, unknown>;
}

export function normalizeFirestoreTrip(
  docId: string,
  raw: Record<string, unknown>,
  usersById: Map<string, UserProfile>,
): Trip {
  const travelerObj =
    raw.traveler && typeof raw.traveler === 'object'
      ? (raw.traveler as Record<string, unknown>)
      : null;

  const travelerId =
    (typeof raw.travelerId === 'string' && raw.travelerId) ||
    (typeof raw.userId === 'string' && raw.userId) ||
    (travelerObj && typeof travelerObj.id === 'string' ? travelerObj.id : '') ||
    'unknown';

  const matchedUser = usersById.get(travelerId);

  const originCity = extractPlaceString(
    raw.origin,
    raw.originCity,
    raw.departureCity,
  );
  const originCountry =
    (typeof raw.originCountry === 'string' && raw.originCountry) ||
    (typeof raw.departureCountry === 'string' && raw.departureCountry) ||
    '';
  const destinationCity = extractPlaceString(
    raw.destination,
    raw.destinationCity,
    raw.arrivalCity,
  );
  const destinationCountry =
    (typeof raw.destinationCountry === 'string' && raw.destinationCountry) ||
    (typeof raw.arrivalCountry === 'string' && raw.arrivalCountry) ||
    '';

  const departureDate =
    normalizeDateString(raw.departureDate) ||
    normalizeDateString(raw.lastDropOffDate) ||
    normalizeDateString(raw.createdAt) ||
    '';
  const arrivalDate =
    normalizeDateString(raw.arrivalDate) ||
    normalizeDateString(raw.checkOutDate) ||
    departureDate;

  const availableWeightKg =
    Number(
      raw.weightKg ??
        raw.availableWeightKg ??
        raw.weightAvailableKg ??
        raw.weightCapacityKg ??
        0,
    ) || 0;

  const pricePerKgUsd =
    Number(raw.pricePerKg ?? raw.pricePerKgUsd ?? raw.feePerKg ?? 0) || 0;
  const serviceFeeType: 'free' | 'paid' =
    raw.serviceFeeType === 'free' ||
    (raw.serviceFeeType !== 'paid' && pricePerKgUsd === 0)
      ? 'free'
      : 'paid';

  const rawCode =
    typeof raw.tripCode === 'string' && raw.tripCode
      ? raw.tripCode
      : `LK-${docId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`;

  const acceptedItemsRaw = Array.isArray(raw.acceptedCategories)
    ? raw.acceptedCategories
    : Array.isArray(raw.acceptedItems)
      ? raw.acceptedItems
      : [];

  return {
    id: docId,
    tripCode: rawCode,
    travelerId,
    travelerName:
      (typeof raw.travelerName === 'string' && raw.travelerName) ||
      (travelerObj && typeof travelerObj.name === 'string' && travelerObj.name) ||
      matchedUser?.name ||
      'Luu Kyone Traveler',
    travelerAvatarUrl:
      (typeof raw.travelerAvatarUrl === 'string' && raw.travelerAvatarUrl) ||
      (travelerObj &&
      typeof travelerObj.avatarUrl === 'string' &&
      travelerObj.avatarUrl
        ? travelerObj.avatarUrl
        : undefined) ||
      matchedUser?.avatarUrl,
    travelerVerified: Boolean(
      raw.travelerVerified ??
        travelerObj?.isVerified ??
        matchedUser?.verificationStatus === 'Verified',
    ),
    originCity,
    originCountry,
    originCode: deriveAirportCode(
      originCity,
      typeof raw.originCode === 'string' ? raw.originCode : undefined,
    ),
    destinationCity,
    destinationCountry,
    destinationCode: deriveAirportCode(
      destinationCity,
      typeof raw.destinationCode === 'string' ? raw.destinationCode : undefined,
    ),
    departureDate,
    arrivalDate,
    completedDate: normalizeDateString(raw.completedDate) || undefined,
    availableWeightKg,
    carriedWeightKg:
      typeof raw.carriedWeightKg === 'number' ? raw.carriedWeightKg : undefined,
    pricePerKgUsd,
    serviceFeeType,
    feeDescription:
      typeof raw.feeDescription === 'string' ? raw.feeDescription : undefined,
    departureHandoverSpot:
      (typeof raw.departureHandoverSpot === 'string' &&
        raw.departureHandoverSpot) ||
      (typeof raw.dropOffLocationNote === 'string' && raw.dropOffLocationNote) ||
      undefined,
    destinationPickupSpot:
      (typeof raw.destinationPickupSpot === 'string' &&
        raw.destinationPickupSpot) ||
      (typeof raw.pickUpLocationNote === 'string' && raw.pickUpLocationNote) ||
      undefined,
    acceptedCategories: acceptedItemsRaw.map(String) as ItemCategory[],
    status: normalizeTripStatus(raw.status),
    notes:
      (typeof raw.notes === 'string' && raw.notes) ||
      (typeof raw.announcement === 'string' && raw.announcement) ||
      '',
    contactChannels: normalizeContacts(raw.contactChannels || raw.contacts),
    createdAt: normalizeDateString(raw.createdAt) || departureDate,
  };
}

function normalizeAnnouncement(
  docId: string,
  raw: Record<string, unknown>,
): Announcement {
  const severity: AnnouncementSeverity =
    raw.severity === 'Critical' ||
    raw.severity === 'Warning' ||
    raw.severity === 'Info'
      ? raw.severity
      : 'Info';
  return {
    id: docId,
    title: typeof raw.title === 'string' ? raw.title : 'Announcement',
    message: typeof raw.message === 'string' ? raw.message : '',
    corridor: typeof raw.corridor === 'string' ? raw.corridor : 'All Corridors',
    severity,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    createdAt: normalizeDateString(raw.createdAt) || new Date().toISOString().slice(0, 10),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : 'Admin',
  };
}

function normalizeAuditLog(
  docId: string,
  raw: Record<string, unknown>,
): AuditLogEntry {
  const category =
    raw.category === 'trip' ||
    raw.category === 'user' ||
    raw.category === 'moderation' ||
    raw.category === 'announcement' ||
    raw.category === 'auth' ||
    raw.category === 'admin' ||
    raw.category === 'settings'
      ? raw.category
      : 'settings';
  return {
    id: docId,
    actorName: typeof raw.actorName === 'string' ? raw.actorName : 'Admin',
    actorEmail:
      typeof raw.actorEmail === 'string' ? raw.actorEmail : undefined,
    actorRole: typeof raw.actorRole === 'string' ? raw.actorRole : 'Admin',
    action: typeof raw.action === 'string' ? raw.action : '',
    target: typeof raw.target === 'string' ? raw.target : '',
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : normalizeDateString(raw.createdAt),
    category,
  };
}

function toFirestoreTripPayload(trip: Omit<Trip, 'id'>): Record<string, unknown> {
  const pricePerKg = Number(trip.pricePerKgUsd ?? 0);
  const weightKg = Number(trip.availableWeightKg);
  const payload: Record<string, unknown> = {
    tripCode: trip.tripCode,
    travelerId: trip.travelerId,
    userId: trip.travelerId,
    travelerName: trip.travelerName,
    travelerAvatarUrl: trip.travelerAvatarUrl || '',
    travelerVerified: Boolean(trip.travelerVerified),
    origin: trip.originCity,
    originCity: trip.originCity,
    departureCity: trip.originCity,
    originCountry: trip.originCountry,
    departureCountry: trip.originCountry,
    originCode: trip.originCode,
    destination: trip.destinationCity,
    destinationCity: trip.destinationCity,
    arrivalCity: trip.destinationCity,
    destinationCountry: trip.destinationCountry,
    arrivalCountry: trip.destinationCountry,
    destinationCode: trip.destinationCode,
    departureDate: trip.departureDate,
    lastDropOffDate: trip.departureDate,
    arrivalDate: trip.arrivalDate,
    checkOutDate: trip.arrivalDate,
    weightKg,
    availableWeightKg: weightKg,
    weightCapacityKg: weightKg,
    weightAvailableKg: weightKg,
    pricePerKg,
    pricePerKgUsd: pricePerKg,
    serviceFeeType: trip.serviceFeeType || (pricePerKg > 0 ? 'paid' : 'free'),
    feeDescription:
      trip.feeDescription ||
      (pricePerKg > 0 ? `$${pricePerKg}/kg` : 'Free community carry'),
    departureHandoverSpot: trip.departureHandoverSpot || '',
    dropOffLocationNote: trip.departureHandoverSpot || '',
    destinationPickupSpot: trip.destinationPickupSpot || '',
    pickUpLocationNote: trip.destinationPickupSpot || '',
    acceptedCategories: trip.acceptedCategories,
    acceptedItems: trip.acceptedCategories,
    status: trip.status,
    notes: trip.notes,
    announcement: trip.notes,
    contactChannels: {
      whatsapp: trip.contactChannels.whatsapp || '',
      telegram: trip.contactChannels.telegram || '',
      facebook: trip.contactChannels.facebook || '',
      viber: trip.contactChannels.viber || '',
    },
    contacts: {
      whatsapp: trip.contactChannels.whatsapp || '',
      telegram: trip.contactChannels.telegram || '',
      facebook: trip.contactChannels.facebook || '',
      viber: trip.contactChannels.viber || '',
    },
    createdAt: trip.createdAt || new Date().toISOString().slice(0, 10),
    updatedAt: serverTimestamp(),
  };

  if (trip.completedDate) payload.completedDate = trip.completedDate;
  if (typeof trip.carriedWeightKg === 'number') {
    payload.carriedWeightKg = trip.carriedWeightKg;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Authentication & Role Guard Services
// ---------------------------------------------------------------------------

export const ACCESS_DENIED_ADMIN_ERROR =
  'Access Denied: Admin privileges required';

export async function fetchVerifiedAdminProfile(
  firebaseUser: FirebaseUser,
): Promise<UserProfile> {
  const userPath = `${COLLECTIONS.USERS}/${firebaseUser.uid}`;
  let userSnap;
  try {
    userSnap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error(ACCESS_DENIED_ADMIN_ERROR);
  }

  const rawData = userSnap.data() as Record<string, unknown>;
  if (rawData.role !== 'admin') {
    await signOut(auth);
    throw new Error(ACCESS_DENIED_ADMIN_ERROR);
  }

  const profile = normalizeFirestoreUser(userSnap.id, rawData);
  if (!canAccessAdminDashboard(profile)) {
    await signOut(auth);
    throw new Error(ACCESS_DENIED_ADMIN_ERROR);
  }

  return profile;
}

export async function signInAdminWithEmail(
  email: string,
  password: string,
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password,
  );
  return fetchVerifiedAdminProfile(credential.user);
}

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

// ---------------------------------------------------------------------------
// Real-Time Firestore Listeners (onSnapshot)
// ---------------------------------------------------------------------------

export function subscribeToUsers(
  onData: (users: UserProfile[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, COLLECTIONS.USERS),
    (snapshot) => {
      const users = snapshot.docs
        .map((d) =>
          normalizeFirestoreUser(d.id, d.data() as Record<string, unknown>),
        )
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
      onData(users);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.USERS);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export function subscribeToTripsRaw(
  onData: (docs: RawFirestoreDoc[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTIONS.TRIPS), orderBy('createdAt', 'desc')),
    (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        data: d.data() as Record<string, unknown>,
      }));
      onData(docs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.TRIPS);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export function subscribeToAnnouncements(
  onData: (announcements: Announcement[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      orderBy('createdAt', 'desc'),
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((d) =>
          normalizeAnnouncement(d.id, d.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => {
      try {
        handleFirestoreError(
          error,
          OperationType.LIST,
          COLLECTIONS.ANNOUNCEMENTS,
        );
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export function subscribeToAuditLogs(
  onData: (logs: AuditLogEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      orderBy('timestamp', 'desc'),
    ),
    (snapshot) => {
      onData(
        snapshot.docs.map((d) =>
          normalizeAuditLog(d.id, d.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.AUDIT_LOGS);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export function subscribeToDashboardSettings(
  onData: (settings: AdminDashboardSettings) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `${COLLECTIONS.SETTINGS}/dashboard`;
  return onSnapshot(
    doc(db, COLLECTIONS.SETTINGS, 'dashboard'),
    (snap) => {
      if (snap.exists()) {
        onData({
          ...DEFAULT_DASHBOARD_SETTINGS,
          ...(snap.data() as Partial<AdminDashboardSettings>),
        });
      } else {
        onData(DEFAULT_DASHBOARD_SETTINGS);
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function fetchTripsOnce(
  usersById: Map<string, UserProfile>,
): Promise<Trip[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.TRIPS), orderBy('createdAt', 'desc')),
    );
    return snap.docs.map((d) =>
      normalizeFirestoreTrip(
        d.id,
        d.data() as Record<string, unknown>,
        usersById,
      ),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTIONS.TRIPS);
  }
}

// ---------------------------------------------------------------------------
// Trips CRUD Service Functions
// ---------------------------------------------------------------------------

export async function createTripInStore(trip: Omit<Trip, 'id'>): Promise<Trip> {
  const payload = toFirestoreTripPayload(trip);
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.TRIPS), payload);
    return { ...trip, id: ref.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.TRIPS);
  }
}

export async function updateTripInStore(
  tripId: string,
  updates: Partial<Trip>,
): Promise<void> {
  const path = `${COLLECTIONS.TRIPS}/${tripId}`;
  const firestoreUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.travelerId !== undefined) {
    firestoreUpdates.travelerId = updates.travelerId;
    firestoreUpdates.userId = updates.travelerId;
  }
  if (updates.travelerName !== undefined) {
    firestoreUpdates.travelerName = updates.travelerName;
  }
  if (updates.travelerAvatarUrl !== undefined) {
    firestoreUpdates.travelerAvatarUrl = updates.travelerAvatarUrl;
  }
  if (updates.travelerVerified !== undefined) {
    firestoreUpdates.travelerVerified = updates.travelerVerified;
  }
  if (updates.originCity !== undefined) {
    firestoreUpdates.origin = updates.originCity;
    firestoreUpdates.originCity = updates.originCity;
    firestoreUpdates.departureCity = updates.originCity;
  }
  if (updates.originCountry !== undefined) {
    firestoreUpdates.originCountry = updates.originCountry;
    firestoreUpdates.departureCountry = updates.originCountry;
  }
  if (updates.originCode !== undefined) {
    firestoreUpdates.originCode = updates.originCode;
  }
  if (updates.destinationCity !== undefined) {
    firestoreUpdates.destination = updates.destinationCity;
    firestoreUpdates.destinationCity = updates.destinationCity;
    firestoreUpdates.arrivalCity = updates.destinationCity;
  }
  if (updates.destinationCountry !== undefined) {
    firestoreUpdates.destinationCountry = updates.destinationCountry;
    firestoreUpdates.arrivalCountry = updates.destinationCountry;
  }
  if (updates.destinationCode !== undefined) {
    firestoreUpdates.destinationCode = updates.destinationCode;
  }
  if (updates.departureDate !== undefined) {
    firestoreUpdates.departureDate = updates.departureDate;
    firestoreUpdates.lastDropOffDate = updates.departureDate;
  }
  if (updates.arrivalDate !== undefined) {
    firestoreUpdates.arrivalDate = updates.arrivalDate;
    firestoreUpdates.checkOutDate = updates.arrivalDate;
  }
  if (updates.completedDate !== undefined) {
    firestoreUpdates.completedDate = updates.completedDate;
  }
  if (updates.availableWeightKg !== undefined) {
    firestoreUpdates.weightKg = updates.availableWeightKg;
    firestoreUpdates.availableWeightKg = updates.availableWeightKg;
    firestoreUpdates.weightCapacityKg = updates.availableWeightKg;
    firestoreUpdates.weightAvailableKg = updates.availableWeightKg;
  }
  if (updates.carriedWeightKg !== undefined) {
    firestoreUpdates.carriedWeightKg = updates.carriedWeightKg;
  }
  if (updates.pricePerKgUsd !== undefined) {
    firestoreUpdates.pricePerKg = updates.pricePerKgUsd;
    firestoreUpdates.pricePerKgUsd = updates.pricePerKgUsd;
  }
  if (updates.serviceFeeType !== undefined) {
    firestoreUpdates.serviceFeeType = updates.serviceFeeType;
  }
  if (updates.feeDescription !== undefined) {
    firestoreUpdates.feeDescription = updates.feeDescription;
  }
  if (updates.departureHandoverSpot !== undefined) {
    firestoreUpdates.departureHandoverSpot = updates.departureHandoverSpot;
    firestoreUpdates.dropOffLocationNote = updates.departureHandoverSpot;
  }
  if (updates.destinationPickupSpot !== undefined) {
    firestoreUpdates.destinationPickupSpot = updates.destinationPickupSpot;
    firestoreUpdates.pickUpLocationNote = updates.destinationPickupSpot;
  }
  if (updates.acceptedCategories !== undefined) {
    firestoreUpdates.acceptedCategories = updates.acceptedCategories;
    firestoreUpdates.acceptedItems = updates.acceptedCategories;
  }
  if (updates.notes !== undefined) {
    firestoreUpdates.notes = updates.notes;
    firestoreUpdates.announcement = updates.notes;
  }
  if (updates.contactChannels !== undefined) {
    firestoreUpdates.contactChannels = {
      whatsapp: updates.contactChannels.whatsapp || '',
      telegram: updates.contactChannels.telegram || '',
      facebook: updates.contactChannels.facebook || '',
      viber: updates.contactChannels.viber || '',
    };
    firestoreUpdates.contacts = firestoreUpdates.contactChannels;
  }
  if (updates.status !== undefined) {
    firestoreUpdates.status = updates.status;
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), firestoreUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTripInStore(tripId: string): Promise<void> {
  const path = `${COLLECTIONS.TRIPS}/${tripId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Users KYC & Account Management Service Functions
// ---------------------------------------------------------------------------

export async function updateUserVerificationInStore(
  userId: string,
  verificationStatus: VerificationStatus,
): Promise<void> {
  const path = `${COLLECTIONS.USERS}/${userId}`;
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      verificationStatus,
      isVerified: verificationStatus === 'Verified',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleUserAccountStatusInStore(
  userId: string,
  accountStatus: AccountStatus,
): Promise<void> {
  const path = `${COLLECTIONS.USERS}/${userId}`;
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      accountStatus,
      isSuspended: accountStatus === 'Suspended',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Announcements CRUD Service Functions
// ---------------------------------------------------------------------------

export async function createAnnouncementInStore(
  announcement: Omit<Announcement, 'id'>,
): Promise<Announcement> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), {
      ...announcement,
      updatedAt: serverTimestamp(),
    });
    return { ...announcement, id: ref.id };
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      COLLECTIONS.ANNOUNCEMENTS,
    );
  }
}

export async function toggleAnnouncementInStore(
  announcementId: string,
  isActive: boolean,
): Promise<void> {
  const path = `${COLLECTIONS.ANNOUNCEMENTS}/${announcementId}`;
  try {
    await updateDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAnnouncementInStore(
  announcementId: string,
): Promise<void> {
  const path = `${COLLECTIONS.ANNOUNCEMENTS}/${announcementId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Audit Logs, Admin Provisioning & Settings Service Functions
// ---------------------------------------------------------------------------

export async function appendAuditLogInStore(
  entry: Omit<AuditLogEntry, 'id'>,
): Promise<AuditLogEntry> {
  try {
    const payload: Record<string, unknown> = {
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      target: entry.target,
      timestamp: entry.timestamp,
      category: entry.category,
      createdAt: serverTimestamp(),
    };
    if (entry.actorEmail) payload.actorEmail = entry.actorEmail;

    const ref = await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), payload);
    return { ...entry, id: ref.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTIONS.AUDIT_LOGS);
  }
}

export async function createAdminAccountInStore(
  input: CreateAdminAccountInput,
): Promise<UserProfile> {
  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const handle = input.handle?.trim()
    ? input.handle.trim().startsWith('@')
      ? input.handle.trim()
      : `@${input.handle.trim()}`
    : `@${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'admin'}`;
  const nowDate = new Date().toISOString().slice(0, 10);

  let uid = '';
  let secondaryApp: FirebaseApp | null = null;

  try {
    secondaryApp = initializeApp(
      firebaseConfig,
      `admin-provision-${Date.now()}`,
    );
    const secondaryAuth = getAuth(secondaryApp);
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      normalizedEmail,
      input.password,
    );
    uid = credential.user.uid;
    await signOut(secondaryAuth);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'auth/email-already-in-use') {
      throw new Error('This email address is already registered in Firebase Auth.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters.');
    }
    throw err instanceof Error
      ? err
      : new Error('Unable to create Firebase Auth account.');
  } finally {
    if (secondaryApp) {
      await deleteApp(secondaryApp).catch(() => {});
    }
  }

  const firestorePayload = {
    uid,
    name: trimmedName,
    displayName: trimmedName,
    photoURL: '',
    handle,
    email: normalizedEmail,
    phone: input.phone?.trim() || 'Not provided',
    role: 'admin' as const,
    verificationStatus: 'Verified' as const,
    isVerified: true,
    accountStatus: 'Active' as const,
    isSuspended: false,
    joinedAt: nowDate,
    nationality: 'International',
    kycNotes: input.adminScope?.trim() || 'Operations Admin',
    warningsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const userDocPath = `${COLLECTIONS.USERS}/${uid}`;
  try {
    await setDoc(doc(db, COLLECTIONS.USERS, uid), firestorePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userDocPath);
  }

  return {
    id: uid,
    uid,
    name: trimmedName,
    handle,
    email: normalizedEmail,
    phone: input.phone?.trim() || 'Not provided',
    role: 'admin',
    verificationStatus: 'Verified',
    accountStatus: 'Active',
    joinedAt: nowDate,
    nationality: 'International',
    kycNotes: input.adminScope?.trim() || 'Operations Admin',
    warningsCount: 0,
  };
}

export async function saveDashboardSettingsInStore(
  settings: AdminDashboardSettings,
): Promise<AdminDashboardSettings> {
  const path = `${COLLECTIONS.SETTINGS}/dashboard`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.SETTINGS, 'dashboard'),
      {
        ...settings,
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
    return settings;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
