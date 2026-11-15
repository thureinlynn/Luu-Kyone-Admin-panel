import type { AdminDashboardSettings } from '../types';

export const DEFAULT_DASHBOARD_SETTINGS: AdminDashboardSettings = {
  platformName: 'Luu Kyone',
  supportEmail: 'support@luukyone.com',
  defaultPageSize: 20,
  maxLuggageWeightKg: 200,
  requireKycForTrips: true,
  autoFlagHighWeightKg: true,
  highWeightThresholdKg: 25,
  maintenanceMode: false,
  emailAlertsFlagged: true,
  emailAlertsPendingKyc: true,
  sessionTimeoutMinutes: 120,
};
