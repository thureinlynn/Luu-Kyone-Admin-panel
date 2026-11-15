export type UserRole = 'admin' | 'traveler' | 'sender';

export type VerificationStatus = 'Verified' | 'Pending' | 'Unverified';

export type AccountStatus = 'Active' | 'Suspended';

export type TripStatus = 'Active' | 'Completed' | 'Cancelled';

export type ItemCategory =
  | 'Urgent Documents & Letters'
  | 'Clothing & Fashion Goods'
  | 'Sealed Packaged Food & Snacks'
  | 'Electronics & Tech Accessories'
  | 'Cosmetics & Personal Care'
  | 'Books, Stationery & Prints'
  | 'Gifts & Souvenirs'
  | 'Prescription Medicines (with receipt)';

export interface ContactChannels {
  whatsapp?: string;
  telegram?: string;
  facebook?: string;
  viber?: string;
}

export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  handle: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  joinedAt: string;
  nationality: string;
  passportLast4?: string;
  kycSubmittedAt?: string;
  kycNotes?: string;
  warningsCount: number;
}

export interface Trip {
  id: string;
  tripCode: string;
  travelerId: string;
  travelerName: string;
  travelerAvatarUrl?: string;
  travelerVerified: boolean;
  originCity: string;
  originCountry: string;
  originCode: string;
  destinationCity: string;
  destinationCountry: string;
  destinationCode: string;
  departureDate: string; // Last Drop-Off Date (YYYY-MM-DD)
  arrivalDate: string; // Check-Out / Delivery Date (YYYY-MM-DD)
  completedDate?: string; // YYYY-MM-DD
  availableWeightKg: number;
  carriedWeightKg?: number;
  pricePerKgUsd?: number;
  serviceFeeType?: 'free' | 'paid';
  feeDescription?: string;
  departureHandoverSpot?: string;
  destinationPickupSpot?: string;
  acceptedCategories: ItemCategory[];
  status: TripStatus;
  notes: string; // Trip Announcement & Information Notice
  contactChannels: ContactChannels;
  createdAt: string;
}

export type FlagSeverity = 'High' | 'Medium' | 'Low';
export type FlagStatus = 'Open' | 'Dismissed' | 'Removed';

export interface FlaggedContent {
  id: string;
  tripId: string;
  tripCode: string;
  travelerId: string;
  travelerName: string;
  routeLabel: string;
  reason: string;
  details: string;
  reportedBy: string;
  reportedAt: string;
  severity: FlagSeverity;
  status: FlagStatus;
}

export type AnnouncementSeverity = 'Info' | 'Warning' | 'Critical';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  corridor: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  target: string;
  timestamp: string;
  category: 'trip' | 'user' | 'moderation' | 'announcement' | 'auth';
}

export interface DashboardKpis {
  activeTrips: number;
  finishedTrips: number;
  totalUsers: number;
  pendingVerifications: number;
  totalActiveWeightKg: number;
}

export interface MonthlyTripVolumePoint {
  monthKey: string;
  label: string;
  active: number;
  finished: number;
}

export interface RouteVolumePoint {
  route: string;
  trips: number;
  weightKg: number;
}

export interface TripFormInput {
  travelerId: string;
  originCity: string;
  originCountry: string;
  originCode: string;
  destinationCity: string;
  destinationCountry: string;
  destinationCode: string;
  departureDate: string; // Last Drop-Off Date
  arrivalDate: string; // Check-Out / Delivery Date
  availableWeightKg: number;
  pricePerKgUsd?: number;
  serviceFeeType?: 'free' | 'paid';
  feeDescription?: string;
  departureHandoverSpot: string;
  destinationPickupSpot: string;
  acceptedCategories: ItemCategory[];
  status: TripStatus;
  notes: string;
  contactChannels: ContactChannels;
}
