import {
  deleteApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_DASHBOARD_SETTINGS,
  SEED_ADMIN_USER,
  SEED_ANNOUNCEMENTS,
  SEED_AUDIT_LOGS,
  SEED_FLAGGED_CONTENT,
  SEED_TRIPS,
  SEED_USERS,
} from '../data/mockData';
import type {
  AccountStatus,
  AdminDashboardSettings,
  Announcement,
  AuditLogEntry,
  ContactChannels,
  CreateAdminAccountInput,
  FlaggedContent,
  ItemCategory,
  Trip,
  TripStatus,
  UserProfile,
  VerificationStatus,
} from '../types';
import {
  canAccessAdminDashboard,
  deriveAirportCode,
  sortTripsNewestFirst,
} from '../utils/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseServices(): {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
} {
  if (!isFirebaseConfigured()) {
    return { app: null, auth: null, db: null };
  }
  if (!appInstance) {
    appInstance =
      getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    try {
      dbInstance = initializeFirestore(appInstance, {
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      dbInstance = getFirestore(appInstance);
    }
  }
  return { app: appInstance, auth: authInstance, db: dbInstance };
}

export const COLLECTIONS = {
  USERS: 'users',
  TRIPS: 'trips',
  FLAGGED: 'flagged_content',
  ANNOUNCEMENTS: 'announcements',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
} as const;

const SETTINGS_STORAGE_KEY = 'luu_kyone_dashboard_settings';

// ---------------------------------------------------------------------------
// Luu Kyone Firestore Document Normalization & Serialization
// ---------------------------------------------------------------------------

function normalizeTripStatus(rawStatus: unknown): TripStatus {
  const s = String(rawStatus || 'active').toLowerCase();
  if (s === 'completed' || s === 'finished' || s === 'done') return 'Completed';
  if (s === 'cancelled' || s === 'canceled' || s === 'removed')
    return 'Cancelled';
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

function normalizeIsoTimestampString(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    try {
      return (raw as { toDate: () => Date }).toDate().toISOString();
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
    whatsapp: typeof c.whatsapp === 'string' ? c.whatsapp : undefined,
    telegram: typeof c.telegram === 'string' ? c.telegram : undefined,
    facebook: typeof c.facebook === 'string' ? c.facebook : undefined,
    viber: typeof c.viber === 'string' ? c.viber : undefined,
  };
}

function normalizeFirestoreUser(
  docId: string,
  raw: Record<string, unknown>,
): UserProfile {
  const name =
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.displayName === 'string' && raw.displayName) ||
    'Traveler';
  const email = typeof raw.email === 'string' ? raw.email : '';
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
    uid: typeof raw.uid === 'string' ? raw.uid : docId,
    name,
    handle,
    email,
    phone,
    role,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : undefined,
    verificationStatus,
    accountStatus,
    joinedAt:
      normalizeDateString(raw.createdAt) ||
      (typeof raw.memberSince === 'string' ? raw.memberSince : '2026-11-01'),
    nationality:
      typeof raw.nationality === 'string' ? raw.nationality : 'International',
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

function normalizeFirestoreTrip(
  docId: string,
  raw: Record<string, unknown>,
  usersById: Map<string, UserProfile>,
): Trip {
  const travelerObj =
    raw.traveler && typeof raw.traveler === 'object'
      ? (raw.traveler as Record<string, unknown>)
      : null;

  const travelerId =
    (typeof raw.userId === 'string' && raw.userId) ||
    (typeof raw.travelerId === 'string' && raw.travelerId) ||
    (travelerObj && typeof travelerObj.id === 'string' ? travelerObj.id : '') ||
    'unknown';

  const matchedUser = usersById.get(travelerId);

  const originCity =
    (typeof raw.departureCity === 'string' && raw.departureCity) ||
    (typeof raw.originCity === 'string' && raw.originCity) ||
    'Unknown';
  const originCountry =
    (typeof raw.departureCountry === 'string' && raw.departureCountry) ||
    (typeof raw.originCountry === 'string' && raw.originCountry) ||
    '';
  const destinationCity =
    (typeof raw.arrivalCity === 'string' && raw.arrivalCity) ||
    (typeof raw.destinationCity === 'string' && raw.destinationCity) ||
    'Unknown';
  const destinationCountry =
    (typeof raw.arrivalCountry === 'string' && raw.arrivalCountry) ||
    (typeof raw.destinationCountry === 'string' && raw.destinationCountry) ||
    '';

  const departureDate =
    normalizeDateString(raw.lastDropOffDate) ||
    normalizeDateString(raw.departureDate) ||
    normalizeDateString(raw.createdAt) ||
    '2026-11-15';
  const arrivalDate =
    normalizeDateString(raw.checkOutDate) ||
    normalizeDateString(raw.arrivalDate) ||
    departureDate;

  const availableWeightKg =
    Number(
      raw.weightAvailableKg ??
        raw.weightCapacityKg ??
        raw.availableWeightKg ??
        0,
    ) || 0;

  const pricePerKgUsd = Number(raw.pricePerKgUsd ?? raw.feePerKg ?? 0) || 0;
  const serviceFeeType: 'free' | 'paid' =
    raw.serviceFeeType === 'free' || (raw.serviceFeeType !== 'paid' && pricePerKgUsd === 0)
      ? 'free'
      : 'paid';

  const rawCode =
    typeof raw.tripCode === 'string' && raw.tripCode
      ? raw.tripCode
      : `LK-${docId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`;

  const acceptedItemsRaw = Array.isArray(raw.acceptedItems)
    ? raw.acceptedItems
    : Array.isArray(raw.acceptedCategories)
      ? raw.acceptedCategories
      : [];

  return {
    id: docId,
    tripCode: rawCode,
    travelerId,
    travelerName:
      (travelerObj && typeof travelerObj.name === 'string' && travelerObj.name) ||
      (typeof raw.travelerName === 'string' && raw.travelerName) ||
      matchedUser?.name ||
      'Luu Kyone Traveler',
    travelerAvatarUrl:
      (travelerObj &&
        typeof travelerObj.avatarUrl === 'string' &&
        travelerObj.avatarUrl) ||
      (typeof raw.travelerAvatarUrl === 'string' && raw.travelerAvatarUrl) ||
      matchedUser?.avatarUrl,
    travelerVerified: Boolean(
      travelerObj?.isVerified ??
        raw.travelerVerified ??
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
      (typeof raw.dropOffLocationNote === 'string' && raw.dropOffLocationNote) ||
      (typeof raw.departureHandoverSpot === 'string' &&
        raw.departureHandoverSpot) ||
      undefined,
    destinationPickupSpot:
      (typeof raw.pickUpLocationNote === 'string' && raw.pickUpLocationNote) ||
      (typeof raw.destinationPickupSpot === 'string' &&
        raw.destinationPickupSpot) ||
      undefined,
    acceptedCategories: acceptedItemsRaw.map(String) as ItemCategory[],
    status: normalizeTripStatus(raw.status),
    notes:
      (typeof raw.announcement === 'string' && raw.announcement) ||
      (typeof raw.notes === 'string' && raw.notes) ||
      '',
    contactChannels: normalizeContacts(raw.contacts || raw.contactChannels),
    createdAt: normalizeIsoTimestampString(raw.createdAt) || departureDate,
  };
}

function toLuuKyoneFirestoreTrip(trip: Trip): Record<string, unknown> {
  return {
    id: trip.id,
    userId: trip.travelerId,
    traveler: {
      id: trip.travelerId,
      name: trip.travelerName,
      avatarUrl: trip.travelerAvatarUrl || '',
      isVerified: trip.travelerVerified,
    },
    departureCity: trip.originCity,
    departureCountry: trip.originCountry,
    originCode: trip.originCode,
    arrivalCity: trip.destinationCity,
    arrivalCountry: trip.destinationCountry,
    destinationCode: trip.destinationCode,
    departureDate: trip.departureDate,
    lastDropOffDate: trip.departureDate,
    arrivalDate: trip.arrivalDate,
    checkOutDate: trip.arrivalDate,
    weightCapacityKg: trip.availableWeightKg,
    weightAvailableKg: trip.availableWeightKg,
    serviceFeeType:
      trip.serviceFeeType || ((trip.pricePerKgUsd ?? 0) > 0 ? 'paid' : 'free'),
    feeDescription:
      trip.feeDescription ||
      ((trip.pricePerKgUsd ?? 0) > 0
        ? `$${trip.pricePerKgUsd}/kg`
        : 'Free community carry'),
    pricePerKgUsd: trip.pricePerKgUsd ?? 0,
    dropOffLocationNote: trip.departureHandoverSpot || '',
    pickUpLocationNote: trip.destinationPickupSpot || '',
    acceptedItems: trip.acceptedCategories,
    prohibitedItems: [
      'Liquids over 100ml in carry-on',
      'Lithium batteries (loose)',
      'Perishable fresh foods',
      'Restricted customs items',
    ],
    announcement: trip.notes,
    contacts: {
      whatsapp: trip.contactChannels.whatsapp || '',
      telegram: trip.contactChannels.telegram || '',
      facebook: trip.contactChannels.facebook || '',
      viber: trip.contactChannels.viber || '',
    },
    status: trip.status.toLowerCase(),
    tripCode: trip.tripCode,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Authentication, Connection Verification & Role Guard Services
// ---------------------------------------------------------------------------

export async function verifyFirestoreConnection(): Promise<boolean> {
  const { db } = getFirebaseServices();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, COLLECTIONS.SETTINGS, 'dashboard'));
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.error('Firestore client is offline. Verify Firebase configuration.');
    }
    return false;
  }
}

async function resolveAdminUserProfile(
  db: Firestore,
  uid: string,
  email?: string | null,
): Promise<UserProfile | null> {
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    return normalizeFirestoreUser(
      userSnap.id,
      userSnap.data() as Record<string, unknown>,
    );
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (normalizedEmail) {
    const emailQuery = await getDocs(
      query(
        collection(db, COLLECTIONS.USERS),
        where('email', '==', normalizedEmail),
      ),
    );
    if (!emailQuery.empty) {
      const matched = emailQuery.docs[0];
      return normalizeFirestoreUser(
        matched.id,
        matched.data() as Record<string, unknown>,
      );
    }
  }

  return null;
}

export async function signInAdminWithEmail(
  email: string,
  password: string,
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const { auth, db } = getFirebaseServices();

  if (auth && db) {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        throw new Error(
          'Invalid email/password, or this account uses Google Sign-In. Use "Sign in with Google" or send a password setup email below.',
        );
      }
      throw err;
    }

    const profile = await resolveAdminUserProfile(
      db,
      credential.user.uid,
      credential.user.email || normalizedEmail,
    );

    if (!profile) {
      await signOut(auth);
      throw new Error(
        'User profile not found in Firestore. Access to Luu Kyone Admin denied.',
      );
    }

    if (!canAccessAdminDashboard(profile)) {
      await signOut(auth);
      throw new Error(
        'Access denied: your account does not have active admin privileges (role === "admin" required).',
      );
    }

    return profile;
  }

  // Local out-of-the-box authentication simulation when Firebase env vars are unset
  await new Promise((resolve) => setTimeout(resolve, 250));
  const matchedUser = SEED_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail,
  );

  if (!matchedUser || password.length < 6) {
    throw new Error('Invalid email or password. Check credentials and retry.');
  }

  if (!canAccessAdminDashboard(matchedUser)) {
    throw new Error(
      `Access denied for ${matchedUser.email}: role is "${matchedUser.role}", but "admin" is required.`,
    );
  }

  return matchedUser;
}

export async function signInAdminWithGoogle(): Promise<UserProfile> {
  const { auth, db } = getFirebaseServices();
  if (!auth || !db) {
    throw new Error('Firebase Auth is not configured for Google Sign-In.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  const profile = await resolveAdminUserProfile(
    db,
    credential.user.uid,
    credential.user.email,
  );

  if (!profile) {
    await signOut(auth);
    throw new Error(
      'No Luu Kyone profile found for this Google account. Contact a Super Admin.',
    );
  }

  if (!canAccessAdminDashboard(profile)) {
    await signOut(auth);
    throw new Error(
      `Access denied for ${profile.email || credential.user.email}: active admin role required.`,
    );
  }

  return profile;
}

export async function sendAdminPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Enter your admin email address first.');
  }
  const { auth } = getFirebaseServices();
  if (!auth) {
    throw new Error('Firebase Auth is not configured in this environment.');
  }
  await sendPasswordResetEmail(auth, normalizedEmail);
}

export function subscribeToAuthChanges(
  onUserChange: (profile: UserProfile | null, hasFirebaseAuthUser: boolean) => void,
): () => void {
  const { auth, db } = getFirebaseServices();
  if (!auth || !db) {
    return () => {};
  }

  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      onUserChange(null, false);
      return;
    }
    try {
      const profile = await resolveAdminUserProfile(
        db,
        firebaseUser.uid,
        firebaseUser.email,
      );
      if (profile && canAccessAdminDashboard(profile)) {
        onUserChange(profile, true);
      } else {
        await signOut(auth);
        onUserChange(null, false);
      }
    } catch {
      onUserChange(null, true);
    }
  });
}

export async function demoAdminSignIn(): Promise<UserProfile> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return SEED_ADMIN_USER;
}

export async function signOutAdmin(): Promise<void> {
  const { auth } = getFirebaseServices();
  if (auth && auth.currentUser) {
    await signOut(auth);
  }
}

// ---------------------------------------------------------------------------
// Real-Time Firestore Subscriptions & Data Fetching
// ---------------------------------------------------------------------------

export interface RealtimeDashboardCallbacks {
  onTrips: (trips: Trip[]) => void;
  onUsers: (users: UserProfile[]) => void;
  onFlaggedItems: (items: FlaggedContent[]) => void;
  onAnnouncements: (announcements: Announcement[]) => void;
  onAuditLogs: (logs: AuditLogEntry[]) => void;
  onSettings: (settings: AdminDashboardSettings) => void;
  onInitialLoadComplete?: () => void;
  onError?: (source: string, error: Error) => void;
}

export function subscribeToDashboardRealtime(
  callbacks: RealtimeDashboardCallbacks,
): () => void {
  const { db } = getFirebaseServices();
  if (!db) {
    callbacks.onUsers(SEED_USERS);
    callbacks.onTrips(sortTripsNewestFirst(SEED_TRIPS));
    callbacks.onFlaggedItems(SEED_FLAGGED_CONTENT);
    callbacks.onAnnouncements(SEED_ANNOUNCEMENTS);
    callbacks.onAuditLogs(SEED_AUDIT_LOGS);
    callbacks.onSettings(DEFAULT_DASHBOARD_SETTINGS);
    callbacks.onInitialLoadComplete?.();
    return () => {};
  }

  let usersReady = false;
  let tripsReady = false;
  let initialNotified = false;
  let rawUsers: Array<{ id: string; data: Record<string, unknown> }> = [];
  let rawTrips: Array<{ id: string; data: Record<string, unknown> }> = [];

  const maybeNotifyReady = () => {
    if (!initialNotified && usersReady && tripsReady) {
      initialNotified = true;
      callbacks.onInitialLoadComplete?.();
    }
  };

  const emitUsersAndTrips = () => {
    const normalizedUsers: UserProfile[] =
      rawUsers.length === 0
        ? SEED_USERS
        : rawUsers.map((entry) => normalizeFirestoreUser(entry.id, entry.data));

    if (usersReady) {
      callbacks.onUsers(normalizedUsers);
    }

    if (tripsReady) {
      const usersById = new Map<string, UserProfile>();
      for (const u of normalizedUsers) {
        usersById.set(u.id, u);
        if (u.uid && u.uid !== u.id) {
          usersById.set(u.uid, u);
        }
      }
      const normalizedTrips =
        rawTrips.length === 0
          ? SEED_TRIPS
          : rawTrips.map((entry) =>
              normalizeFirestoreTrip(entry.id, entry.data, usersById),
            );
      callbacks.onTrips(sortTripsNewestFirst(normalizedTrips));
    }

    maybeNotifyReady();
  };

  const unsubscribers: Unsubscribe[] = [];

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.USERS),
      (snap) => {
        usersReady = true;
        rawUsers = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        emitUsersAndTrips();
      },
      (error) => {
        usersReady = true;
        maybeNotifyReady();
        callbacks.onError?.('users', error);
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.TRIPS),
      (snap) => {
        tripsReady = true;
        rawTrips = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, unknown>,
        }));
        emitUsersAndTrips();
      },
      (error) => {
        tripsReady = true;
        maybeNotifyReady();
        callbacks.onError?.('trips', error);
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.FLAGGED),
      (snap) => {
        callbacks.onFlaggedItems(
          snap.empty
            ? SEED_FLAGGED_CONTENT
            : snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<FlaggedContent, 'id'>),
              })),
        );
      },
      (error) => callbacks.onError?.('flagged_content', error),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      (snap) => {
        callbacks.onAnnouncements(
          snap.empty
            ? SEED_ANNOUNCEMENTS
            : snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<Announcement, 'id'>),
              })),
        );
      },
      (error) => callbacks.onError?.('announcements', error),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      query(
        collection(db, COLLECTIONS.AUDIT_LOGS),
        orderBy('timestamp', 'desc'),
      ),
      (snap) => {
        callbacks.onAuditLogs(
          snap.empty
            ? SEED_AUDIT_LOGS
            : snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<AuditLogEntry, 'id'>),
              })),
        );
      },
      (error) => callbacks.onError?.('audit_logs', error),
    ),
  );

  unsubscribers.push(
    onSnapshot(
      doc(db, COLLECTIONS.SETTINGS, 'dashboard'),
      (snap) => {
        if (snap.exists()) {
          const merged = {
            ...DEFAULT_DASHBOARD_SETTINGS,
            ...(snap.data() as Partial<AdminDashboardSettings>),
          };
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
          callbacks.onSettings(merged);
        } else {
          callbacks.onSettings(DEFAULT_DASHBOARD_SETTINGS);
        }
      },
      (error) => callbacks.onError?.('settings', error),
    ),
  );

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}

export async function fetchInitialDashboardData(): Promise<{
  trips: Trip[];
  users: UserProfile[];
  flaggedItems: FlaggedContent[];
  announcements: Announcement[];
  auditLogs: AuditLogEntry[];
}> {
  const { db } = getFirebaseServices();
  if (!db) {
    return {
      trips: SEED_TRIPS,
      users: SEED_USERS,
      flaggedItems: SEED_FLAGGED_CONTENT,
      announcements: SEED_ANNOUNCEMENTS,
      auditLogs: SEED_AUDIT_LOGS,
    };
  }

  const [tripsSnap, usersSnap, flaggedSnap, annSnap, logsSnap] =
    await Promise.all([
      getDocs(collection(db, COLLECTIONS.TRIPS)),
      getDocs(collection(db, COLLECTIONS.USERS)),
      getDocs(collection(db, COLLECTIONS.FLAGGED)),
      getDocs(collection(db, COLLECTIONS.ANNOUNCEMENTS)),
      getDocs(
        query(
          collection(db, COLLECTIONS.AUDIT_LOGS),
          orderBy('timestamp', 'desc'),
        ),
      ),
    ]);

  const users: UserProfile[] = usersSnap.empty
    ? SEED_USERS
    : usersSnap.docs.map((d) =>
        normalizeFirestoreUser(d.id, d.data() as Record<string, unknown>),
      );

  const usersById = new Map<string, UserProfile>();
  for (const u of users) {
    usersById.set(u.id, u);
    if (u.uid && u.uid !== u.id) {
      usersById.set(u.uid, u);
    }
  }

  const trips: Trip[] = tripsSnap.empty
    ? SEED_TRIPS
    : sortTripsNewestFirst(
        tripsSnap.docs.map((d) =>
          normalizeFirestoreTrip(
            d.id,
            d.data() as Record<string, unknown>,
            usersById,
          ),
        ),
      );

  return {
    trips,
    users,
    flaggedItems: flaggedSnap.empty
      ? SEED_FLAGGED_CONTENT
      : flaggedSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FlaggedContent, 'id'>),
        })),
    announcements: annSnap.empty
      ? SEED_ANNOUNCEMENTS
      : annSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Announcement, 'id'>),
        })),
    auditLogs: logsSnap.empty
      ? SEED_AUDIT_LOGS
      : logsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AuditLogEntry, 'id'>),
        })),
  };
}

// ---------------------------------------------------------------------------
// Trips CRUD Service Functions
// ---------------------------------------------------------------------------

export async function createTripInStore(trip: Omit<Trip, 'id'>): Promise<Trip> {
  const generatedId = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullTrip: Trip = { ...trip, id: generatedId };
  const { db } = getFirebaseServices();
  if (db) {
    const payload = toLuuKyoneFirestoreTrip(fullTrip);
    await setDoc(doc(db, COLLECTIONS.TRIPS, generatedId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  }
  return fullTrip;
}

export async function updateTripInStore(
  tripId: string,
  updates: Partial<Trip>,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    const firestoreUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.travelerId !== undefined)
      firestoreUpdates.userId = updates.travelerId;
    if (updates.originCity !== undefined)
      firestoreUpdates.departureCity = updates.originCity;
    if (updates.originCountry !== undefined)
      firestoreUpdates.departureCountry = updates.originCountry;
    if (updates.originCode !== undefined)
      firestoreUpdates.originCode = updates.originCode;
    if (updates.destinationCity !== undefined)
      firestoreUpdates.arrivalCity = updates.destinationCity;
    if (updates.destinationCountry !== undefined)
      firestoreUpdates.arrivalCountry = updates.destinationCountry;
    if (updates.destinationCode !== undefined)
      firestoreUpdates.destinationCode = updates.destinationCode;
    if (updates.departureDate !== undefined) {
      firestoreUpdates.departureDate = updates.departureDate;
      firestoreUpdates.lastDropOffDate = updates.departureDate;
    }
    if (updates.arrivalDate !== undefined) {
      firestoreUpdates.arrivalDate = updates.arrivalDate;
      firestoreUpdates.checkOutDate = updates.arrivalDate;
    }
    if (updates.availableWeightKg !== undefined) {
      firestoreUpdates.weightCapacityKg = updates.availableWeightKg;
      firestoreUpdates.weightAvailableKg = updates.availableWeightKg;
    }
    if (updates.pricePerKgUsd !== undefined) {
      firestoreUpdates.pricePerKgUsd = updates.pricePerKgUsd;
    }
    if (updates.serviceFeeType !== undefined) {
      firestoreUpdates.serviceFeeType = updates.serviceFeeType;
    }
    if (updates.feeDescription !== undefined) {
      firestoreUpdates.feeDescription = updates.feeDescription;
    }
    if (updates.departureHandoverSpot !== undefined) {
      firestoreUpdates.dropOffLocationNote = updates.departureHandoverSpot;
    }
    if (updates.destinationPickupSpot !== undefined) {
      firestoreUpdates.pickUpLocationNote = updates.destinationPickupSpot;
    }
    if (updates.acceptedCategories !== undefined) {
      firestoreUpdates.acceptedItems = updates.acceptedCategories;
    }
    if (updates.notes !== undefined) {
      firestoreUpdates.announcement = updates.notes;
    }
    if (updates.contactChannels !== undefined) {
      firestoreUpdates.contacts = updates.contactChannels;
    }
    if (updates.status !== undefined) {
      firestoreUpdates.status = updates.status.toLowerCase();
    }

    await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), firestoreUpdates);
  }
}

export async function deleteTripInStore(tripId: string): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId));
  }
}

// ---------------------------------------------------------------------------
// Users KYC & Moderation Service Functions
// ---------------------------------------------------------------------------

export async function updateUserVerificationInStore(
  userId: string,
  verificationStatus: VerificationStatus,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      verificationStatus,
      isVerified: verificationStatus === 'Verified',
      updatedAt: serverTimestamp(),
    });
  }
}

export async function toggleUserAccountStatusInStore(
  userId: string,
  accountStatus: AccountStatus,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      accountStatus,
      isSuspended: accountStatus === 'Suspended',
      updatedAt: serverTimestamp(),
    });
  }
}

// ---------------------------------------------------------------------------
// Flagged Content & Announcements Service Functions
// ---------------------------------------------------------------------------

export async function updateFlagStatusInStore(
  flagId: string,
  status: FlaggedContent['status'],
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await updateDoc(doc(db, COLLECTIONS.FLAGGED, flagId), {
      status,
      resolvedAt: serverTimestamp(),
    });
  }
}

export async function createAnnouncementInStore(
  announcement: Omit<Announcement, 'id'>,
): Promise<Announcement> {
  const { db } = getFirebaseServices();
  if (db) {
    const ref = await addDoc(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      announcement,
    );
    return { ...announcement, id: ref.id };
  }
  return { ...announcement, id: `ann-${Date.now()}` };
}

export async function toggleAnnouncementInStore(
  announcementId: string,
  isActive: boolean,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await updateDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId), {
      isActive,
    });
  }
}

export async function deleteAnnouncementInStore(
  announcementId: string,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (db) {
    await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId));
  }
}

export async function appendAuditLogInStore(
  entry: Omit<AuditLogEntry, 'id'>,
): Promise<AuditLogEntry> {
  const { db } = getFirebaseServices();
  if (db) {
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), entry);
      return { ...entry, id: ref.id };
    } catch {
      // Fallback gracefully in preview/demo sessions if Firestore rules restrict writes
    }
  }
  return { ...entry, id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
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

  let uid = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { db } = getFirebaseServices();

  if (db && isFirebaseConfigured()) {
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
      // Continue with Firestore/local admin profile record if auth creation is restricted in preview
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch(() => {});
      }
    }

    const firestorePayload = {
      uid,
      name: trimmedName,
      displayName: trimmedName,
      handle,
      email: normalizedEmail,
      phone: input.phone?.trim() || 'Not provided',
      role: 'admin',
      verificationStatus: 'Verified',
      isVerified: true,
      accountStatus: 'Active',
      isSuspended: false,
      joinedAt: nowDate,
      nationality: 'International',
      kycNotes: input.adminScope?.trim() || 'Operations Admin',
      warningsCount: 0,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, COLLECTIONS.USERS, uid), firestorePayload);
    } catch {
      // Fallback to in-memory state if Firestore rules restrict writes in preview
    }
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

export async function fetchDashboardSettings(): Promise<AdminDashboardSettings> {
  const { db } = getFirebaseServices();
  if (db) {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'dashboard'));
      if (snap.exists()) {
        const merged = {
          ...DEFAULT_DASHBOARD_SETTINGS,
          ...(snap.data() as Partial<AdminDashboardSettings>),
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch {
      // Fall back to local storage or defaults
    }
  }
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      return {
        ...DEFAULT_DASHBOARD_SETTINGS,
        ...(JSON.parse(saved) as Partial<AdminDashboardSettings>),
      };
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_DASHBOARD_SETTINGS;
}

export async function saveDashboardSettingsInStore(
  settings: AdminDashboardSettings,
): Promise<AdminDashboardSettings> {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  const { db } = getFirebaseServices();
  if (db) {
    try {
      await setDoc(
        doc(db, COLLECTIONS.SETTINGS, 'dashboard'),
        {
          ...settings,
          updatedAtServer: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      // Saved to localStorage if Firestore rules reject unauthenticated writes
    }
  }
  return settings;
}

