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
  createAnnouncementInStore,
  createTripInStore,
  deleteAnnouncementInStore,
  deleteTripInStore,
  demoAdminSignIn,
  fetchInitialDashboardData,
  isFirebaseConfigured,
  signInAdminWithEmail,
  signOutAdmin,
  toggleAnnouncementInStore,
  toggleUserAccountStatusInStore,
  updateFlagStatusInStore,
  updateTripInStore,
  updateUserVerificationInStore,
} from '../services/firebase';
import type {
  AccountStatus,
  Announcement,
  AuditLogEntry,
  FlaggedContent,
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
  authLoading: boolean;
  authError: string | null;
  firebaseConnected: boolean;
  isLoadingData: boolean;
  trips: Trip[];
  users: UserProfile[];
  flaggedItems: FlaggedContent[];
  announcements: Announcement[];
  auditLogs: AuditLogEntry[];
  toast: ToastMessage | null;
  dismissToast: () => void;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  loginDemoAdmin: () => Promise<void>;
  logout: () => Promise<void>;
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

const SESSION_STORAGE_KEY = 'luu_kyone_admin_session';

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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed && parsed.role === 'admin') return parsed;
      }
    } catch {
      // Ignore invalid local storage
    }
    return null;
  });

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<FlaggedContent[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

  // Load initial data when authenticated
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    setIsLoadingData(true);
    fetchInitialDashboardData()
      .then((data) => {
        if (!active) return;
        setTrips(data.trips);
        setUsers(data.users);
        setFlaggedItems(data.flaggedItems);
        setAnnouncements(data.announcements);
        setAuditLogs(data.auditLogs);
      })
      .finally(() => {
        if (active) setIsLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser]);

  const recordAudit = useCallback(
    async (
      action: string,
      target: string,
      category: AuditLogEntry['category'],
    ) => {
      const entry: Omit<AuditLogEntry, 'id'> = {
        actorName: currentUser?.name || 'Admin',
        actorRole: 'Admin',
        action,
        target,
        timestamp: formatNowTimestamp(),
        category,
      };
      const saved = await appendAuditLogInStore(entry);
      setAuditLogs((prev) => [saved, ...prev]);
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
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
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
    [],
  );

  const loginDemoAdmin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const adminUser = await demoAdminSignIn();
      setCurrentUser(adminUser);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(adminUser));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOutAdmin();
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUser(null);
    setAuthError(null);
  }, []);

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
      setTrips((prev) => [created, ...prev]);
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

  const dismissFlag = useCallback(
    async (flagId: string) => {
      const flag = flaggedItems.find((f) => f.id === flagId);
      await updateFlagStatusInStore(flagId, 'Dismissed');
      setFlaggedItems((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, status: 'Dismissed' } : f)),
      );
      if (flag) {
        await recordAudit(
          `Dismissed flag on #${flag.tripCode}`,
          flag.reason,
          'moderation',
        );
        showToast(`Flag on #${flag.tripCode} dismissed.`, 'info');
      }
    },
    [flaggedItems, recordAudit, showToast],
  );

  const removeListingAndWarn = useCallback(
    async (flagId: string) => {
      const flag = flaggedItems.find((f) => f.id === flagId);
      if (!flag) return;
      await Promise.all([
        updateFlagStatusInStore(flagId, 'Removed'),
        updateTripInStore(flag.tripId, { status: 'Cancelled' }),
      ]);
      setFlaggedItems((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, status: 'Removed' } : f)),
      );
      setTrips((prev) =>
        prev.map((t) =>
          t.id === flag.tripId ? { ...t, status: 'Cancelled' } : t,
        ),
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === flag.travelerId
            ? { ...u, warningsCount: u.warningsCount + 1 }
            : u,
        ),
      );
      await recordAudit(
        `Removed #${flag.tripCode} & warned ${flag.travelerName}`,
        flag.reason,
        'moderation',
      );
      showToast(
        `Listing #${flag.tripCode} cancelled and warning issued.`,
        'warning',
      );
    },
    [flaggedItems, recordAudit, showToast],
  );

  const addAnnouncement = useCallback(
    async (input: Omit<Announcement, 'id' | 'createdAt' | 'createdBy'>) => {
      const payload: Omit<Announcement, 'id'> = {
        ...input,
        createdAt: formatNowTimestamp().slice(0, 10),
        createdBy: currentUser?.name || 'Admin',
      };
      const created = await createAnnouncementInStore(payload);
      setAnnouncements((prev) => [created, ...prev]);
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
      authLoading,
      authError,
      firebaseConnected,
      isLoadingData,
      trips,
      users,
      flaggedItems,
      announcements,
      auditLogs,
      toast,
      dismissToast,
      loginWithEmail,
      loginDemoAdmin,
      logout,
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
      authLoading,
      authError,
      firebaseConnected,
      isLoadingData,
      trips,
      users,
      flaggedItems,
      announcements,
      auditLogs,
      toast,
      dismissToast,
      loginWithEmail,
      loginDemoAdmin,
      logout,
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
