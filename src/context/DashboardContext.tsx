import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  appendAuditLogInStore,
  createAdminAccountInStore,
  createAnnouncementInStore,
  createTripInStore,
  deleteAnnouncementInStore,
  deleteTripInStore,
  isFirebaseConfigured,
  saveDashboardSettingsInStore,
  sendAdminPasswordReset,
  signInAdminWithEmail,
  signInAdminWithGoogle,
  signOutAdmin,
  subscribeToAuthChanges,
  subscribeToDashboardRealtime,
  toggleAnnouncementInStore,
  toggleUserAccountStatusInStore,
  updateTripInStore,
  updateUserVerificationInStore,
  verifyFirestoreConnection,
} from '../services/firebase';
import { DEFAULT_DASHBOARD_SETTINGS } from '../constants/settings';
import type {
  AccountStatus,
  AdminDashboardSettings,
  Announcement,
  AuditLogEntry,
  CreateAdminAccountInput,
  FlaggedContent,
  Trip,
  TripFormInput,
  UserProfile,
  VerificationStatus,
} from '../types';
import {
  canAccessAdminDashboard,
  deriveAirportCode,
  generateNextTripCode,
  mergeAndSortAuditLogs,
  upsertById,
} from '../utils/analytics';

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
  flaggedItems: FlaggedContent[];
  announcements: Announcement[];
  auditLogs: AuditLogEntry[];
  settings: AdminDashboardSettings;
  toast: ToastMessage | null;
  dismissToast: () => void;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
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
  dismissFlag: (flagId: string) => Promise<void>;
  removeListingAndWarn: (flagId: string) => Promise<void>;
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

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const firebaseConnected = isFirebaseConfigured();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(() => !firebaseConnected);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [flaggedItems] = useState<FlaggedContent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<AdminDashboardSettings>(
    DEFAULT_DASHBOARD_SETTINGS,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  // Synchronize real Firebase Auth state across reloads
  useEffect(() => {
    if (!firebaseConnected) {
      setAuthReady(true);
      return;
    }
    return subscribeToAuthChanges((profile, _hasFirebaseAuthUser, errMsg) => {
      if (profile && canAccessAdminDashboard(profile)) {
        setCurrentUser(profile);
        setAuthError(null);
      } else {
        setCurrentUser(null);
        if (errMsg) {
          setAuthError(errMsg);
        }
      }
      setAuthReady(true);
    });
  }, [firebaseConnected]);

  // Verify Firestore connection once an admin is authenticated
  useEffect(() => {
    if (firebaseConnected && authReady && currentUser) {
      void verifyFirestoreConnection();
    }
  }, [firebaseConnected, authReady, currentUser?.id]);

  // Subscribe to real-time Firestore streams only after Firebase Auth resolves
  useEffect(() => {
    if (!authReady || !currentUser || !canAccessAdminDashboard(currentUser)) {
      setIsLoadingData(false);
      setDataError(null);
      setTrips([]);
      setUsers([]);
      setAnnouncements([]);
      setAuditLogs([]);
      return;
    }

    setIsLoadingData(true);
    setDataError(null);

    const unsubscribe = subscribeToDashboardRealtime({
      onTrips: (liveTrips) => {
        setTrips(liveTrips);
        setDataError(null);
      },
      onUsers: (liveUsers) => {
        setUsers(liveUsers);
        setDataError(null);
        const updatedSelf = liveUsers.find(
          (u) => u.id === currentUser.id || u.uid === currentUser.uid,
        );
        if (updatedSelf && !canAccessAdminDashboard(updatedSelf)) {
          void signOutAdmin();
          setCurrentUser(null);
          setAuthError(
            'Your administrator access was revoked or suspended.',
          );
        }
      },
      onFlaggedItems: () => {
        // Moderation queue removed; no Firestore subscription required.
      },
      onAnnouncements: (liveAnnouncements) => {
        setAnnouncements(liveAnnouncements);
      },
      onAuditLogs: (liveLogs) => {
        setAuditLogs((prev) => mergeAndSortAuditLogs(prev, liveLogs));
      },
      onSettings: (liveSettings) => {
        setSettings(liveSettings);
      },
      onInitialLoadComplete: () => {
        setIsLoadingData(false);
      },
      onError: (source, error) => {
        console.error(`Realtime listener error (${source}):`, error);
        setDataError(`${source}: ${error.message}`);
        setIsLoadingData(false);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [authReady, currentUser?.id]);

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
      try {
        const saved = await appendAuditLogInStore(entry);
        setAuditLogs((prev) => mergeAndSortAuditLogs(prev, [saved]));
      } catch (err) {
        console.error('Unable to append audit log:', err);
      }
    },
    [currentUser],
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const user = await signInAdminWithEmail(email, password);
        setCurrentUser(user);
        setAuthReady(true);
        void recordAudit(
          'Admin account signed in',
          `Authenticated via email (${user.email})`,
          'auth',
          user,
        );
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to sign in.';
        setAuthError(message);
        return false;
      } finally {
        setAuthLoading(false);
      }
    },
    [recordAudit],
  );

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const user = await signInAdminWithGoogle();
      setCurrentUser(user);
      setAuthReady(true);
      void recordAudit(
        'Admin account signed in',
        `Authenticated via Google (${user.email})`,
        'auth',
        user,
      );
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setAuthError(message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [recordAudit]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      await sendAdminPasswordReset(email);
      showToast(
        `Password setup / reset email sent to ${email.trim().toLowerCase()}.`,
        'info',
      );
    },
    [showToast],
  );

  const logout = useCallback(async () => {
    if (currentUser) {
      await recordAudit(
        'Admin account signed out',
        `Ended session (${currentUser.email})`,
        'auth',
        currentUser,
      );
    }
    await signOutAdmin();
    setCurrentUser(null);
    setAuthError(null);
  }, [currentUser, recordAudit]);

  const createAdminAccount = useCallback(
    async (input: CreateAdminAccountInput): Promise<UserProfile> => {
      const created = await createAdminAccountInStore(input);
      setUsers((prev) => upsertById(prev, created));
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
      setSettings(saved);
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
      const traveler = users.find((u) => u.id === input.travelerId);
      const nextCode = generateNextTripCode(trips);
      const newTripPayload: Omit<Trip, 'id'> = {
        tripCode: nextCode,
        travelerId: input.travelerId,
        travelerName: traveler?.name || 'Unknown Traveler',
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
      setTrips((prev) => upsertById(prev, created));
      await recordAudit(
        `Created Trip #${created.tripCode}`,
        `${created.originCity} → ${created.destinationCity} (${created.availableWeightKg} kg) for ${created.travelerName}`,
        'trip',
      );
      showToast(`Trip #${created.tripCode} created.`);
      return created;
    },
    [trips, users, recordAudit, showToast],
  );

  const editTrip = useCallback(
    async (tripId: string, input: TripFormInput) => {
      const existing = trips.find((t) => t.id === tripId);
      if (!existing) return;

      const traveler = users.find((u) => u.id === input.travelerId);
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
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, ...updates } : t)),
      );
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
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
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
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, verificationStatus } : u,
        ),
      );
      setTrips((prev) =>
        prev.map((t) =>
          t.travelerId === userId
            ? { ...t, travelerVerified: verificationStatus === 'Verified' }
            : t,
        ),
      );
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
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, accountStatus } : u)),
      );
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

  const dismissFlag = useCallback(async (_flagId: string) => {}, []);

  const removeListingAndWarn = useCallback(async (_flagId: string) => {}, []);

  const addAnnouncement = useCallback(
    async (input: Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>) => {
      const payload: Omit<Announcement, 'id'> = {
        ...input,
        createdAt: formatNowTimestamp().slice(0, 10),
        createdBy: currentUser?.name || 'Admin',
      };
      const created = await createAnnouncementInStore(payload);
      setAnnouncements((prev) => upsertById(prev, created));
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
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive } : a)),
      );
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
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
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
      flaggedItems,
      announcements,
      auditLogs,
      settings,
      toast,
      dismissToast,
      loginWithEmail,
      loginWithGoogle,
      sendPasswordReset,
      logout,
      createAdminAccount,
      saveSettings,
      addTrip,
      editTrip,
      removeTrip,
      setUserVerification,
      setUserAccountStatus,
      dismissFlag,
      removeListingAndWarn,
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
      flaggedItems,
      announcements,
      auditLogs,
      settings,
      toast,
      dismissToast,
      loginWithEmail,
      loginWithGoogle,
      sendPasswordReset,
      logout,
      createAdminAccount,
      saveSettings,
      addTrip,
      editTrip,
      removeTrip,
      setUserVerification,
      setUserAccountStatus,
      dismissFlag,
      removeListingAndWarn,
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
