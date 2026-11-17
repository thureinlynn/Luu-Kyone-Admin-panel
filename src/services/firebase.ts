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
  sendEmailVerification,
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
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { DEFAULT_DASHBOARD_SETTINGS } from '../constants/settings';
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

const BOOTSTRAPPED_ADMIN_EMAIL = 'thureinlynn.mm@gmail.com';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    firebaseAppletConfig.authDomain ||
    '',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseAppletConfig.projectId ||
    '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket ||
    '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseAppletConfig.messagingSenderId ||
    '',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '',
};

const rawDatabaseId = String(
  import.meta.env.VITE_FIREBASE_DATABASE_ID ??
    firebaseAppletConfig.firestoreDatabaseId ??
    '',
).trim();

const firestoreDatabaseId: string | undefined =
  !rawDatabaseId || rawDatabaseId === '(default)' || rawDatabaseId === 'default'
    ? undefined
    : rawDatabaseId;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function isFirebaseAuthenticated(): boolean {
  const { auth } = getFirebaseServices();
  return Boolean(auth?.currentUser);
}

export function getFirebaseTargetInfo(): {
  projectId: string;
  databaseId: string;
} {
  return {
    projectId: firebaseConfig.projectId,
    databaseId: firestoreDatabaseId || '(default)',
  };
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
      dbInstance = initializeFirestore(
        appInstance,
        { experimentalAutoDetectLongPolling: true },
        firestoreDatabaseId,
      );
    } catch {
      dbInstance = firestoreDatabaseId
        ? getFirestore(appInstance, firestoreDatabaseId)
        : getFirestore(appInstance);
    }
  }
  return { app: appInstance, auth: authInstance, db: dbInstance };
}

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

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  const auth = authInstance;
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

function logFirestoreSnapshotError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): Error {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return error instanceof Error ? error : new Error(errInfo.error);
}

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
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    try {
      return new Date(raw).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }
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
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    try {
      return new Date(raw).toISOString();
    } catch {
      return '';
    }
  }
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
    whatsapp: typeof c.whatsapp === 'string' && c.whatsapp ? c.whatsapp : undefined,
    telegram: typeof c.telegram === 'string' && c.telegram ? c.telegram : undefined,
    facebook: typeof c.facebook === 'string' && c.facebook ? c.facebook : undefined,
    viber: typeof c.viber === 'string' && c.viber ? c.viber : undefined,
  };
}

function serializeContacts(channels: ContactChannels | undefined): Record<string, string> {
  return {
    whatsapp: channels?.whatsapp?.trim() || '',
    telegram: channels?.telegram?.trim() || '',
    facebook: channels?.facebook?.trim() || '',
    viber: channels?.viber?.trim() || '',
  };
}

function normalizeFirestoreUser(
  docId: string,
  raw: Record<string, unknown>,
): UserProfile {
  const name =
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.displayName === 'string' && raw.displayName) ||
    (typeof raw.fullName === 'string' && raw.fullName) ||
    (typeof raw.username === 'string' && raw.username) ||
    'Traveler';
  const email = typeof raw.email === 'string' ? raw.email : '';
  const contacts = normalizeContacts(raw.contacts);
  const phone =
    (typeof raw.phone === 'string' && raw.phone) ||
    (typeof raw.phoneNumber === 'string' && raw.phoneNumber) ||
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
    avatarUrl:
      (typeof raw.avatarUrl === 'string' && raw.avatarUrl) ||
      (typeof raw.photoURL === 'string' && raw.photoURL) ||
      undefined,
    verificationStatus,
    accountStatus,
    joinedAt:
      normalizeDateString(raw.createdAt) ||
      (typeof raw.joinedAt === 'string' && raw.joinedAt) ||
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
    (typeof raw.travelerId === 'string' && raw.travelerId) ||
    (typeof raw.userId === 'string' && raw.userId) ||
    (travelerObj && typeof travelerObj.id === 'string' ? travelerObj.id : '') ||
    'unknown';

  const matchedUser = usersById.get(travelerId);

  const originCity =
    (typeof raw.departureCity === 'string' && raw.departureCity) ||
    (typeof raw.originCity === 'string' && raw.originCity) ||
    (typeof raw.origin === 'string' && raw.origin) ||
    'Unknown';
  const originCountry =
    (typeof raw.departureCountry === 'string' && raw.departureCountry) ||
    (typeof raw.originCountry === 'string' && raw.originCountry) ||
    '';
  const destinationCity =
    (typeof raw.arrivalCity === 'string' && raw.arrivalCity) ||
    (typeof raw.destinationCity === 'string' && raw.destinationCity) ||
    (typeof raw.destination === 'string' && raw.destination) ||
    'Unknown';
  const destinationCountry =
    (typeof raw.arrivalCountry === 'string' && raw.arrivalCountry) ||
    (typeof raw.destinationCountry === 'string' && raw.destinationCountry) ||
    '';

  const departureDate =
    normalizeDateString(raw.lastDropOffDate) ||
    normalizeDateString(raw.departureDate) ||
    normalizeDateString(raw.flightDate) ||
    normalizeDateString(raw.travelDate) ||
    normalizeDateString(raw.date) ||
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
        raw.weightKg ??
        raw.luggageWeightKg ??
        raw.capacityKg ??
        0,
    ) || 0;

  const pricePerKgUsd =
    Number(raw.pricePerKgUsd ?? raw.pricePerKg ?? raw.feePerKg ?? raw.fee ?? 0) || 0;
  const serviceFeeType: 'free' | 'paid' =
    raw.serviceFeeType === 'free' ||
    (raw.serviceFeeType !== 'paid' && pricePerKgUsd === 0)
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
  const pricePerKg = trip.pricePerKgUsd ?? 0;
  const serializedContacts = serializeContacts(trip.contactChannels);
  const payload: Record<string, unknown> = {
    id: trip.id,
    tripCode: trip.tripCode,
    travelerId: trip.travelerId,
    userId: trip.travelerId,
    travelerName: trip.travelerName,
    travelerAvatarUrl: trip.travelerAvatarUrl || '',
    travelerVerified: trip.travelerVerified,
    traveler: {
      id: trip.travelerId,
      name: trip.travelerName,
      avatarUrl: trip.travelerAvatarUrl || '',
      isVerified: trip.travelerVerified,
    },
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
    weightKg: trip.availableWeightKg,
    availableWeightKg: trip.availableWeightKg,
    weightCapacityKg: trip.availableWeightKg,
    weightAvailableKg: trip.availableWeightKg,
    serviceFeeType: trip.serviceFeeType || (pricePerKg > 0 ? 'paid' : 'free'),
    feeDescription:
      trip.feeDescription ||
      (pricePerKg > 0 ? `$${pricePerKg}/kg` : 'Free community carry'),
    pricePerKg,
    pricePerKgUsd: pricePerKg,
    departureHandoverSpot: trip.departureHandoverSpot || '',
    dropOffLocationNote: trip.departureHandoverSpot || '',
    destinationPickupSpot: trip.destinationPickupSpot || '',
    pickUpLocationNote: trip.destinationPickupSpot || '',
    acceptedCategories: trip.acceptedCategories,
    acceptedItems: trip.acceptedCategories,
    prohibitedItems: [
      'Liquids over 100ml in carry-on',
      'Lithium batteries (loose)',
      'Perishable fresh foods',
      'Restricted customs items',
    ],
    notes: trip.notes,
    announcement: trip.notes,
    contactChannels: serializedContacts,
    contacts: serializedContacts,
    status: trip.status.toLowerCase(),
    createdAt: trip.createdAt || new Date().toISOString(),
  };
  if (trip.completedDate) {
    payload.completedDate = trip.completedDate;
  }
  if (typeof trip.carriedWeightKg === 'number') {
    payload.carriedWeightKg = trip.carriedWeightKg;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Authentication, Connection Verification & Role Guard Services
// ---------------------------------------------------------------------------

export async function verifyFirestoreConnection(): Promise<boolean> {
  const { db } = getFirebaseServices();
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.error(
        'Please check your Firebase configuration. Firestore client is offline.',
      );
      return false;
    }
    return true;
  }
}

async function resolveAdminUserProfile(
  db: Firestore,
  uid: string,
  email?: string | null,
  emailVerified?: boolean,
  displayName?: string | null,
): Promise<UserProfile | null> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const isBootstrappedSuperAdmin =
    normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL && Boolean(emailVerified);
  const userDocRef = doc(db, COLLECTIONS.USERS, uid);

  let foundProfile: UserProfile | null = null;

  try {
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      foundProfile = normalizeFirestoreUser(
        userSnap.id,
        userSnap.data() as Record<string, unknown>,
      );
    }
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code !== 'permission-denied') {
      throw err;
    }
  }

  if (!foundProfile && normalizedEmail) {
    try {
      const emailQuery = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where('email', '==', normalizedEmail),
        ),
      );
      if (!emailQuery.empty) {
        const matched = emailQuery.docs[0];
        foundProfile = normalizeFirestoreUser(
          matched.id,
          matched.data() as Record<string, unknown>,
        );
      }
    } catch {
      // Non-admin or unbootstrapped accounts cannot list /users by email per security rules
    }
  }

  if (isBootstrappedSuperAdmin) {
    const adminName = foundProfile?.name || displayName?.trim() || 'Thurein Lynn';
    const handle =
      foundProfile?.handle ||
      `@${adminName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'thureinlynn'}`;
    const nowDate = foundProfile?.joinedAt || new Date().toISOString().slice(0, 10);

    if (
      !foundProfile ||
      foundProfile.role !== 'admin' ||
      foundProfile.accountStatus !== 'Active'
    ) {
      const bootstrapPayload = {
        uid,
        email: normalizedEmail,
        name: adminName,
        displayName: adminName,
        handle,
        role: 'admin',
        isVerified: true,
        verificationStatus: 'Verified',
        accountStatus: 'Active',
        isSuspended: false,
        joinedAt: nowDate,
        nationality: foundProfile?.nationality || 'International',
        kycNotes: 'Super Admin',
        warningsCount: foundProfile?.warningsCount ?? 0,
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(userDocRef, bootstrapPayload, { merge: true });
      } catch {
        // Bootstrapped Super Admin retains rules-level admin access even if initial upsert is deferred
      }
    }

    return {
      id: uid,
      uid,
      name: adminName,
      handle,
      email: normalizedEmail,
      phone: foundProfile?.phone || 'Not provided',
      role: 'admin',
      avatarUrl: foundProfile?.avatarUrl,
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      joinedAt: nowDate,
      nationality: foundProfile?.nationality || 'International',
      kycNotes: 'Super Admin',
      warningsCount: foundProfile?.warningsCount ?? 0,
    };
  }

  return foundProfile;
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
  if (!auth || !db) {
    throw new Error(
      'Firebase Auth is not configured. Check your Firebase project settings.',
    );
  }

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
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is disabled in Firebase Authentication for this project. Enable Email/Password in Firebase Console → Authentication → Sign-in method.',
      );
    }
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      throw new Error(
        'Invalid email or password. Verify your credentials or use "Set / Reset Password" above.',
      );
    }
    throw err;
  }

  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // Ignore rate-limit errors if a verification email was recently sent
    }
    await signOut(auth);
    throw new Error(
      `Email verification required for ${normalizedEmail}. A verification link was sent to your inbox — click it, then sign in again.`,
    );
  }

  const profile = await resolveAdminUserProfile(
    db,
    credential.user.uid,
    credential.user.email || normalizedEmail,
    credential.user.emailVerified,
    credential.user.displayName,
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

export async function signInAdminWithGoogle(
  loginHint?: string,
): Promise<UserProfile> {
  const { auth, db } = getFirebaseServices();
  if (!auth || !db) {
    throw new Error('Firebase Auth is not configured for Google Sign-In.');
  }
  const provider = new GoogleAuthProvider();
  const trimmedHint = loginHint?.trim().toLowerCase();
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(trimmedHint ? { login_hint: trimmedHint } : {}),
  });

  let credential;
  try {
    credential = await signInWithPopup(auth, provider);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google sign-in popup was closed before completing.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Browser blocked the sign-in popup. Allow popups for this site and try again.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'This preview domain is not yet allowlisted in Firebase Authentication → Settings → Authorized domains.',
      );
    }
    throw err;
  }

  const profile = await resolveAdminUserProfile(
    db,
    credential.user.uid,
    credential.user.email,
    credential.user.emailVerified,
    credential.user.displayName,
  );

  if (!profile) {
    await signOut(auth);
    throw new Error(
      'No Luu Kyone admin profile found for this Google account. Contact a Super Admin.',
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
  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Email/Password sign-in is disabled in Firebase Console. Enable Email/Password under Authentication → Sign-in method first.',
      );
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Too many reset requests. Please wait a few minutes and try again.');
    }
    throw err;
  }
}

export function subscribeToAuthChanges(
  onUserChange: (
    profile: UserProfile | null,
    hasFirebaseAuthUser: boolean,
    errorMessage?: string,
  ) => void,
): () => void {
  const { auth, db } = getFirebaseServices();
  if (!auth || !db) {
    onUserChange(null, false);
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
        firebaseUser.emailVerified,
        firebaseUser.displayName,
      );
      if (profile && canAccessAdminDashboard(profile)) {
        onUserChange(profile, true);
      } else {
        await signOut(auth);
        onUserChange(
          null,
          false,
          profile
            ? `Access denied for ${profile.email}: active admin privileges required.`
            : 'No Luu Kyone admin profile found for this account.',
        );
      }
    } catch (err) {
      onUserChange(
        null,
        true,
        err instanceof Error
          ? err.message
          : 'Unable to verify Firebase admin permissions.',
      );
    }
  });
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
    callbacks.onUsers([]);
    callbacks.onTrips([]);
    callbacks.onFlaggedItems([]);
    callbacks.onAnnouncements([]);
    callbacks.onAuditLogs([]);
    callbacks.onSettings(DEFAULT_DASHBOARD_SETTINGS);
    callbacks.onInitialLoadComplete?.();
    callbacks.onError?.(
      'firebase',
      new Error('Firebase is not configured for live synchronization.'),
    );
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
    const normalizedUsers: UserProfile[] = rawUsers.map((entry) =>
      normalizeFirestoreUser(entry.id, entry.data),
    );

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
      const normalizedTrips = rawTrips.map((entry) =>
        normalizeFirestoreTrip(entry.id, entry.data, usersById),
      );
      callbacks.onTrips(sortTripsNewestFirst(normalizedTrips));
    }

    maybeNotifyReady();
  };

  callbacks.onFlaggedItems([]);

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
        const err = logFirestoreSnapshotError(
          error,
          OperationType.LIST,
          COLLECTIONS.USERS,
        );
        callbacks.onError?.('users', err);
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
        const err = logFirestoreSnapshotError(
          error,
          OperationType.LIST,
          COLLECTIONS.TRIPS,
        );
        callbacks.onError?.('trips', err);
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.ANNOUNCEMENTS),
      (snap) => {
        callbacks.onAnnouncements(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Announcement, 'id'>),
          })),
        );
      },
      (error) => {
        const err = logFirestoreSnapshotError(
          error,
          OperationType.LIST,
          COLLECTIONS.ANNOUNCEMENTS,
        );
        callbacks.onError?.('announcements', err);
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      (snap) => {
        callbacks.onAuditLogs(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditLogEntry, 'id'>),
          })),
        );
      },
      (error) => {
        const err = logFirestoreSnapshotError(
          error,
          OperationType.LIST,
          COLLECTIONS.AUDIT_LOGS,
        );
        callbacks.onError?.('audit_logs', err);
      },
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
      (error) => {
        const err = logFirestoreSnapshotError(
          error,
          OperationType.GET,
          `${COLLECTIONS.SETTINGS}/dashboard`,
        );
        callbacks.onError?.('settings', err);
      },
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
      trips: [],
      users: [],
      flaggedItems: [],
      announcements: [],
      auditLogs: [],
    };
  }

  try {
    const [tripsSnap, usersSnap, annSnap, logsSnap] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.TRIPS)),
      getDocs(collection(db, COLLECTIONS.USERS)),
      getDocs(collection(db, COLLECTIONS.ANNOUNCEMENTS)),
      getDocs(
        query(
          collection(db, COLLECTIONS.AUDIT_LOGS),
          orderBy('timestamp', 'desc'),
        ),
      ),
    ]);

    const users: UserProfile[] = usersSnap.docs.map((d) =>
      normalizeFirestoreUser(d.id, d.data() as Record<string, unknown>),
    );

    const usersById = new Map<string, UserProfile>();
    for (const u of users) {
      usersById.set(u.id, u);
      if (u.uid && u.uid !== u.id) {
        usersById.set(u.uid, u);
      }
    }

    const trips: Trip[] = sortTripsNewestFirst(
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
      flaggedItems: [],
      announcements: annSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Announcement, 'id'>),
      })),
      auditLogs: logsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AuditLogEntry, 'id'>),
      })),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.TRIPS);
  }
}

// ---------------------------------------------------------------------------
// Trips CRUD Service Functions
// ---------------------------------------------------------------------------

export async function createTripInStore(trip: Omit<Trip, 'id'>): Promise<Trip> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  const generatedId = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullTrip: Trip = { ...trip, id: generatedId };
  const payload = toLuuKyoneFirestoreTrip(fullTrip);
  try {
    await setDoc(doc(db, COLLECTIONS.TRIPS, generatedId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `${COLLECTIONS.TRIPS}/${generatedId}`,
    );
  }
  return fullTrip;
}

export async function updateTripInStore(
  tripId: string,
  updates: Partial<Trip>,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
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
    firestoreUpdates.travelerAvatarUrl = updates.travelerAvatarUrl || '';
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
    firestoreUpdates.feeDescription = updates.feeDescription || '';
  }
  if (updates.departureHandoverSpot !== undefined) {
    firestoreUpdates.departureHandoverSpot = updates.departureHandoverSpot || '';
    firestoreUpdates.dropOffLocationNote = updates.departureHandoverSpot || '';
  }
  if (updates.destinationPickupSpot !== undefined) {
    firestoreUpdates.destinationPickupSpot = updates.destinationPickupSpot || '';
    firestoreUpdates.pickUpLocationNote = updates.destinationPickupSpot || '';
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
    const serialized = serializeContacts(updates.contactChannels);
    firestoreUpdates.contactChannels = serialized;
    firestoreUpdates.contacts = serialized;
  }
  if (updates.status !== undefined) {
    firestoreUpdates.status = updates.status.toLowerCase();
  }

  try {
    await updateDoc(doc(db, COLLECTIONS.TRIPS, tripId), firestoreUpdates);
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.TRIPS}/${tripId}`,
    );
  }
}

export async function deleteTripInStore(tripId: string): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.TRIPS, tripId));
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `${COLLECTIONS.TRIPS}/${tripId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Users KYC & Account Status Service Functions
// ---------------------------------------------------------------------------

export async function updateUserVerificationInStore(
  userId: string,
  verificationStatus: VerificationStatus,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      verificationStatus,
      isVerified: verificationStatus === 'Verified',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.USERS}/${userId}`,
    );
  }
}

export async function toggleUserAccountStatusInStore(
  userId: string,
  accountStatus: AccountStatus,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      accountStatus,
      isSuspended: accountStatus === 'Suspended',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.USERS}/${userId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Announcements, Audit Logs & Admin Accounts Service Functions
// ---------------------------------------------------------------------------

export async function createAnnouncementInStore(
  announcement: Omit<Announcement, 'id'>,
): Promise<Announcement> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.ANNOUNCEMENTS), {
      title: announcement.title,
      message: announcement.message,
      corridor: announcement.corridor,
      severity: announcement.severity,
      isActive: announcement.isActive,
      createdAt: announcement.createdAt,
      createdBy: announcement.createdBy,
    });
    return { ...announcement, id: ref.id };
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      COLLECTIONS.ANNOUNCEMENTS,
    );
  }
}

export async function toggleAnnouncementInStore(
  announcementId: string,
  isActive: boolean,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    await updateDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.UPDATE,
      `${COLLECTIONS.ANNOUNCEMENTS}/${announcementId}`,
    );
  }
}

export async function deleteAnnouncementInStore(
  announcementId: string,
): Promise<void> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNOUNCEMENTS, announcementId));
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.DELETE,
      `${COLLECTIONS.ANNOUNCEMENTS}/${announcementId}`,
    );
  }
}

export async function appendAuditLogInStore(
  entry: Omit<AuditLogEntry, 'id'>,
): Promise<AuditLogEntry> {
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  const payload: Record<string, unknown> = {
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    target: entry.target,
    timestamp: entry.timestamp,
    category: entry.category,
    createdAt: serverTimestamp(),
  };
  if (entry.actorEmail) {
    payload.actorEmail = entry.actorEmail;
  }
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), payload);
    return { ...entry, id: ref.id };
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      COLLECTIONS.AUDIT_LOGS,
    );
  }
}

export async function createAdminAccountInStore(
  input: CreateAdminAccountInput,
): Promise<UserProfile> {
  const { db } = getFirebaseServices();
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Firebase Auth & Firestore must be configured to create an admin account.');
  }

  const trimmedName = input.name.trim();
  const normalizedEmail = input.email.trim().toLowerCase();
  const handle = input.handle?.trim()
    ? input.handle.trim().startsWith('@')
      ? input.handle.trim()
      : `@${input.handle.trim()}`
    : `@${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'admin'}`;
  const nowDate = new Date().toISOString().slice(0, 10);

  let uid: string;
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
      throw new Error(
        'This email address is already registered in Firebase Auth.',
      );
    }
    if (code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters.');
    }
    throw err instanceof Error
      ? err
      : new Error('Unable to create Firebase Auth admin account.');
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
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.CREATE,
      `${COLLECTIONS.USERS}/${uid}`,
    );
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
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.GET,
        `${COLLECTIONS.SETTINGS}/dashboard`,
      );
    }
  }
  return DEFAULT_DASHBOARD_SETTINGS;
}

export async function saveDashboardSettingsInStore(
  settings: AdminDashboardSettings,
): Promise<AdminDashboardSettings> {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  const { db } = getFirebaseServices();
  if (!db) {
    throw new Error('Firebase Firestore is not configured.');
  }
  const payload: Record<string, unknown> = {
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    defaultPageSize: settings.defaultPageSize,
    maxLuggageWeightKg: settings.maxLuggageWeightKg,
    requireKycForTrips: settings.requireKycForTrips,
    autoFlagHighWeightKg: settings.autoFlagHighWeightKg,
    highWeightThresholdKg: settings.highWeightThresholdKg,
    maintenanceMode: settings.maintenanceMode,
    emailAlertsFlagged: settings.emailAlertsFlagged,
    emailAlertsPendingKyc: settings.emailAlertsPendingKyc,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    updatedAtServer: serverTimestamp(),
  };
  if (settings.updatedAt) {
    payload.updatedAt = settings.updatedAt;
  }
  if (settings.updatedBy) {
    payload.updatedBy = settings.updatedBy;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'dashboard'), payload, {
      merge: true,
    });
  } catch (err) {
    handleFirestoreError(
      err,
      OperationType.WRITE,
      `${COLLECTIONS.SETTINGS}/dashboard`,
    );
  }
  return settings;
}
