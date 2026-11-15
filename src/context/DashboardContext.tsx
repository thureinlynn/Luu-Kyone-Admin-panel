import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_DASHBOARD_SETTINGS } from '../constants/settings';
import {
  ACCESS_DENIED_ADMIN_ERROR,
  appendAuditLogInStore,
  createAdminAccountInStore,
  createAnnouncementInStore,
  createTripInStore,
  deleteAnnouncementInStore,
  deleteTripInStore,
  fetchVerifiedAdminProfile,
  isFirebaseConfigured,
  normalizeFirestoreTrip,
  type RawFirestoreDoc,
  saveDashboardSettingsInStore,
  signInAdminWithEmail,
  signOutAdmin,
  subscribeToAnnouncements,
  subscribeToAuditLogs,
  subscribeToAuthState,
  subscribeToDashboardSettings,
  subscribeToTripsRaw,
  subscribeToUsers,
  toggleAnnouncementInStore,
  toggleUserAccountStatusInStore,
  updateTripInStore,
  updateUserVerificationInStore,
} from '../services/firebase';
import type {
  AccountStatus,
  AdminDashboardSettings,
  Announcement,
  AuditLogEntry,
  CreateAdminAccountInput,
  Trip,
  TripFormInput,
  UserProfile,
  VerificationStatus,
} from '../types';
import { deriveAirportCode, generateNextTripCode } from '../utils/analytics';

interface ToastMessage {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'warning';
}

interface DashboardContextValue {
  currentUser: UserProfile | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  firebaseConnected: boolean;
  isLoadingData: boolean;
  dataError: string | null;
  trips: Trip[];
  users: UserProfile[];
  announcements: Announcement[];
  auditLogs: AuditLogEntry[];
  settings: AdminDashboardSettings;
  toast: ToastMessage | null;
  dismissToast: () => void;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createAdminAccount: (input: CreateAdminAccountInput) => Promise<UserProfile>;
  saveSettings: (next: AdminDashboardSettings) => Promise<void>;
  addTrip: (input: TripFormInput) => Promise<Trip>;
  editTrip: (tripId: string, input: TripFormInput) => Promise<void>;
  removeTrip: (tripId: string) => Promise<void>;
  setUserVerification: (
    userId: string,
    status: VerificationStatus,
  ) => Promise<void>;
  setUserAccountStatus: (
    userId: string,
    status: AccountStatus,
  ) => Promise<void>;
  addAnnouncement: (
    input: Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>,
  ) => Promise<void>;
  toggleAnnouncement: (id: string, isActive: boolean) => Promise<void>;
  removeAnnouncement: (id: string) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

function formatNowTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatAuthError(err: unknown): string {
  if (
    err instanceof Error &&
    err.message === ACCESS_DENIED_ADMIN_ERROR
  ) {
    return ACCESS_DENIED_ADMIN_ERROR;
  }
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code)
      : '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Please verify your Firebase Auth credentials.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled yet in Firebase Authentication. Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed sign-in attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Firebase Authentication.';
  }
  return err instanceof Error ? err.message : 'Unable to sign in.';
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rawTripDocs, setRawTripDocs] = useState<RawFirestoreDoc[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<AdminDashboardSettings>(
    DEFAULT_DASHBOARD_SETTINGS,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const manualSignInActiveRef = useRef(false);
  const firebaseConnected = isFirebaseConfigured();

  const showToast = useCallback(
    (message: string, tone: ToastMessage['tone'] = 'success') => {
      setToast({ id: String(Date.now()), message, tone });
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Real-time Firebase Auth listener
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (manualSignInActiveRef.current) {
        return;
      }
      if (!firebaseUser) {
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }
      try {
        const profile = await fetchVerifiedAdminProfile(firebaseUser);
        setCurrentUser(profile);
        setAuthError(null);
      } catch (err) {
        setCurrentUser(null);
        setAuthError(formatAuthError(err));
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore onSnapshot listeners (active only for verified admins)
  useEffect(() => {
    if (!authReady || !currentUser) {
      setUsers([]);
      setRawTripDocs([]);
      setAnnouncements([]);
      setAuditLogs([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setDataError(null);

    let usersLoaded = false;
    let tripsLoaded = false;
    const markLoaded = () => {
      if (usersLoaded && tripsLoaded) {
        setIsLoadingData(false);
      }
    };

    const handleListenerError = (err: Error) => {
      setDataError(err.message);
      setIsLoadingData(false);
    };

    const unsubUsers = subscribeToUsers((nextUsers) => {
      setUsers(nextUsers);
      usersLoaded = true;
      markLoaded();
    }, handleListenerError);

    const unsubTrips = subscribeToTripsRaw((docs) => {
      setRawTripDocs(docs);
      tripsLoaded = true;
      markLoaded();
    }, handleListenerError);

    const unsubAnnouncements = subscribeToAnnouncements((items) => {
      setAnnouncements(items);
    }, handleListenerError);

    const unsubLogs = subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
    }, handleListenerError);

    const unsubSettings = subscribeToDashboardSettings((loaded) => {
      setSettings(loaded);
    }, handleListenerError);

    return () => {
      unsubUsers();
      unsubTrips();
      unsubAnnouncements();
      unsubLogs();
      unsubSettings();
    };
  }, [authReady, currentUser]);

  const trips = useMemo(() => {
    const usersById = new Map<string, UserProfile>();
    for (const u of users) {
      usersById.set(u.id, u);
      if (u.uid) usersById.set(u.uid, u);
    }
    return rawTripDocs.map((d) =>
      normalizeFirestoreTrip(d.id, d.data, usersById),
    );
  }, [rawTripDocs, users]);

  const recordAudit = useCallback(
    async (
      action: string,
      target: string,
      category: AuditLogEntry['category'],
      actorOverride?: Pick<UserProfile, 'name' | 'email'>,
    ) => {
      const entry: Omit<AuditLogEntry, 'id'> = {
        actorName: actorOverride?.name || currentUser?.name || 'Admin',
        actorEmail: actorOverride?.email || currentUser?.email,
        actorRole: 'Admin',
        action,
        target,
        timestamp: formatNowTimestamp(),
        category,
      };
      await appendAuditLogInStore(entry);
    },
    [currentUser],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthLoading(true);
      setAuthError(null);
      manualSignInActiveRef.current = true;
      try {
        const user = await signInAdminWithEmail(email, password);
        setCurrentUser(user);
        setAuthReady(true);
        void recordAudit(
          'Admin account signed in',
          `Authenticated via Firebase Auth (${user.email})`,
          'auth',
          user,
        ).catch(() => {});
        return true;
      } catch (err) {
        setCurrentUser(null);
        setAuthError(formatAuthError(err));
        return false;
      } finally {
        manualSignInActiveRef.current = false;
        setAuthLoading(false);
      }
    },
    [recordAudit],
  );

  const logout = useCallback(async () => {
    if (currentUser) {
      await recordAudit(
        'Admin account signed out',
        `Ended session (${currentUser.email})`,
        'auth',
        currentUser,
      ).catch(() => {});
    }
    await signOutAdmin();
    setCurrentUser(null);
    setAuthError(null);
  }, [currentUser, recordAudit]);

  const createAdminAccount = useCallback(
    async (input: CreateAdminAccountInput): Promise<UserProfile> => {
      const created = await createAdminAccountInStore(input);
      await recordAudit(
        `Created admin account ${created.handle}`,
        `${created.name} (${created.email}) — ${created.kycNotes || 'Admin'}`,
        'admin',
      );
      showToast(`Admin account for ${created.name} created.`);
      return created;
    },
    [recordAudit, showToast],
  );

  const saveSettings = useCallback(
    async (next: AdminDashboardSettings) => {
      const payload: AdminDashboardSettings = {
        ...next,
        updatedAt: formatNowTimestamp(),
        updatedBy: currentUser?.name || 'Admin',
      };
      const saved = await saveDashboardSettingsInStore(payload);
      await recordAudit(
        'Updated dashboard settings',
        `Page size ${saved.defaultPageSize}, max weight ${saved.maxLuggageWeightKg} kg, KYC required: ${saved.requireKycForTrips ? 'Yes' : 'No'}`,
        'settings',
      );
      showToast('Dashboard settings saved.');
    },
    [currentUser, recordAudit, showToast],
  );

  const addTrip = useCallback(
    async (input: TripFormInput): Promise<Trip> => {
      const traveler =
        users.find((u) => u.id === input.travelerId || u.uid === input.travelerId) ||
        (currentUser &&
        (currentUser.id === input.travelerId ||
          currentUser.uid === input.travelerId)
          ? currentUser
          : undefined);
      const nextCode = generateNextTripCode(trips);
      const newTripPayload: Omit<Trip, 'id'> = {
        tripCode: nextCode,
        travelerId: input.travelerId,
        travelerName: traveler?.name || 'Luu Kyone Traveler',
        travelerAvatarUrl: traveler?.avatarUrl,
        travelerVerified: traveler?.verificationStatus === 'Verified',
        originCity: input.originCity.trim(),
        originCountry: input.originCountry.trim(),
        originCode: deriveAirportCode(input.originCity, input.originCode),
        destinationCity: input.destinationCity.trim(),
        destinationCountry: input.destinationCountry.trim(),
        destinationCode: deriveAirportCode(
          input.destinationCity,
          input.destinationCode,
        ),
        departureDate: input.departureDate,
        arrivalDate: input.arrivalDate,
        completedDate:
          input.status === 'Completed' ? input.arrivalDate : undefined,
        availableWeightKg: Number(input.availableWeightKg),
        carriedWeightKg:
          input.status === 'Completed'
            ? Number(input.availableWeightKg)
            : undefined,
        pricePerKgUsd: Number(input.pricePerKgUsd ?? 0),
        serviceFeeType: input.serviceFeeType ?? 'free',
        feeDescription: input.feeDescription?.trim() || undefined,
        departureHandoverSpot: input.departureHandoverSpot.trim() || undefined,
        destinationPickupSpot: input.destinationPickupSpot.trim() || undefined,
        acceptedCategories: input.acceptedCategories,
        status: input.status,
        notes: input.notes.trim(),
        contactChannels: {
          whatsapp: input.contactChannels.whatsapp?.trim() || undefined,
          telegram: input.contactChannels.telegram?.trim() || undefined,
          facebook: input.contactChannels.facebook?.trim() || undefined,
          viber: input.contactChannels.viber?.trim() || undefined,
        },
        createdAt: formatNowTimestamp().slice(0, 10),
      };

      const created = await createTripInStore(newTripPayload);
      await recordAudit(
        `Created Trip #${created.tripCode}`,
        `${created.originCity} → ${created.destinationCity} (${created.availableWeightKg} kg) for ${created.travelerName}`,
        'trip',
      );
      showToast(`Trip #${created.tripCode} created.`);
      return created;
    },
    [trips, users, currentUser, recordAudit, showToast],
  );

  const editTrip = useCallback(
    async (tripId: string, input: TripFormInput) => {
      const existing = trips.find((t) => t.id === tripId);
      if (!existing) return;

      const traveler = users.find(
        (u) => u.id === input.travelerId || u.uid === input.travelerId,
      );
      const updates: Partial<Trip> = {
        travelerId: input.travelerId,
        travelerName: traveler?.name || existing.travelerName,
        travelerAvatarUrl: traveler?.avatarUrl || existing.travelerAvatarUrl,
        travelerVerified: traveler
          ? traveler.verificationStatus === 'Verified'
          : existing.travelerVerified,
        originCity: input.originCity.trim(),
        originCountry: input.originCountry.trim(),
        originCode: deriveAirportCode(input.originCity, input.originCode),
        destinationCity: input.destinationCity.trim(),
        destinationCountry: input.destinationCountry.trim(),
        destinationCode: deriveAirportCode(
          input.destinationCity,
          input.destinationCode,
        ),
        departureDate: input.departureDate,
        arrivalDate: input.arrivalDate,
        availableWeightKg: Number(input.availableWeightKg),
        pricePerKgUsd:
          input.pricePerKgUsd !== undefined
            ? Number(input.pricePerKgUsd)
            : existing.pricePerKgUsd ?? 0,
        serviceFeeType:
          input.serviceFeeType ?? existing.serviceFeeType ?? 'free',
        feeDescription: input.feeDescription?.trim() || undefined,
        departureHandoverSpot: input.departureHandoverSpot.trim() || undefined,
        destinationPickupSpot: input.destinationPickupSpot.trim() || undefined,
        acceptedCategories: input.acceptedCategories,
        status: input.status,
        notes: input.notes.trim(),
        contactChannels: {
          whatsapp: input.contactChannels.whatsapp?.trim() || undefined,
          telegram: input.contactChannels.telegram?.trim() || undefined,
          facebook: input.contactChannels.facebook?.trim() || undefined,
          viber: input.contactChannels.viber?.trim() || undefined,
        },
        completedDate:
          input.status === 'Completed'
            ? existing.completedDate || input.arrivalDate
            : undefined,
        carriedWeightKg:
          input.status === 'Completed'
            ? existing.carriedWeightKg ?? Number(input.availableWeightKg)
            : input.status === 'Cancelled'
              ? 0
              : undefined,
      };

      await updateTripInStore(tripId, updates);
      await recordAudit(
        `Edited Trip #${existing.tripCode}`,
        `Updated ${updates.originCity} → ${updates.destinationCity} (${updates.status}, ${updates.availableWeightKg} kg)`,
        'trip',
      );
      showToast(`Trip #${existing.tripCode} updated.`);
    },
    [trips, users, recordAudit, showToast],
  );

  const removeTrip = useCallback(
    async (tripId: string) => {
      const existing = trips.find((t) => t.id === tripId);
      await deleteTripInStore(tripId);
      if (existing) {
        await recordAudit(
          `Deleted Trip #${existing.tripCode}`,
          `Removed ${existing.originCity} → ${existing.destinationCity}`,
          'trip',
        );
        showToast(`Trip #${existing.tripCode} deleted.`, 'info');
      }
    },
    [trips, recordAudit, showToast],
  );

  const setUserVerification = useCallback(
    async (userId: string, verificationStatus: VerificationStatus) => {
      const targetUser = users.find((u) => u.id === userId);
      await updateUserVerificationInStore(userId, verificationStatus);
      if (targetUser) {
        await recordAudit(
          `${verificationStatus === 'Verified' ? 'Verified' : 'Updated KYC for'} user ${targetUser.handle}`,
          `Verification set to ${verificationStatus}`,
          'user',
        );
        showToast(
          `${targetUser.name} verification set to ${verificationStatus}.`,
        );
      }
    },
    [users, recordAudit, showToast],
  );

  const setUserAccountStatus = useCallback(
    async (userId: string, accountStatus: AccountStatus) => {
      const targetUser = users.find((u) => u.id === userId);
      await toggleUserAccountStatusInStore(userId, accountStatus);
      if (targetUser) {
        await recordAudit(
          `${accountStatus === 'Suspended' ? 'Suspended' : 'Reactivated'} user ${targetUser.handle}`,
          `Account status changed to ${accountStatus}`,
          'moderation',
        );
        showToast(
          `${targetUser.name} is now ${accountStatus}.`,
          accountStatus === 'Suspended' ? 'warning' : 'success',
        );
      }
    },
    [users, recordAudit, showToast],
  );

  const addAnnouncement = useCallback(
    async (input: Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>) => {
      const payload: Omit<Announcement, 'id'> = {
        ...input,
        createdAt: formatNowTimestamp().slice(0, 10),
        createdBy: currentUser?.name || 'Admin',
      };
      const created = await createAnnouncementInStore(payload);
      await recordAudit(
        'Published broadcast banner',
        `${created.title} (${created.corridor})`,
        'announcement',
      );
      showToast('Broadcast announcement published.');
    },
    [currentUser, recordAudit, showToast],
  );

  const toggleAnnouncement = useCallback(
    async (id: string, isActive: boolean) => {
      const target = announcements.find((a) => a.id === id);
      await toggleAnnouncementInStore(id, isActive);
      if (target) {
        await recordAudit(
          `${isActive ? 'Activated' : 'Paused'} announcement`,
          target.title,
          'announcement',
        );
        showToast(
          `Banner "${target.title}" ${isActive ? 'activated' : 'paused'}.`,
          'info',
        );
      }
    },
    [announcements, recordAudit, showToast],
  );

  const removeAnnouncement = useCallback(
    async (id: string) => {
      const target = announcements.find((a) => a.id === id);
      await deleteAnnouncementInStore(id);
      if (target) {
        await recordAudit('Deleted announcement', target.title, 'announcement');
        showToast('Announcement deleted.', 'info');
      }
    },
    [announcements, recordAudit, showToast],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      currentUser,
      authReady,
      authLoading,
      authError,
      firebaseConnected,
      isLoadingData,
      dataError,
      trips,
      users,
      announcements,
      auditLogs,
      settings,
      toast,
      dismissToast,
      loginWithEmail,
      logout,
      createAdminAccount,
      saveSettings,
      addTrip,
      editTrip,
      removeTrip,
      setUserVerification,
      setUserAccountStatus,
      addAnnouncement,
      toggleAnnouncement,
      removeAnnouncement,
    }),
    [
      currentUser,
      authReady,
      authLoading,
      authError,
      firebaseConnected,
      isLoadingData,
      dataError,
      trips,
      users,
      announcements,
      auditLogs,
      settings,
      toast,
      dismissToast,
      loginWithEmail,
      logout,
      createAdminAccount,
      saveSettings,
      addTrip,
      editTrip,
      removeTrip,
      setUserVerification,
      setUserAccountStatus,
      addAnnouncement,
      toggleAnnouncement,
      removeAnnouncement,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
}
