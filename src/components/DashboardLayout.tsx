import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Plane,
  Plus,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { Avatar } from './Avatar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  onOpenCreateTrip: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/trips', label: 'Trips', icon: Plane },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/admin-accounts', label: 'Admin Accounts', icon: UserCog },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const ROUTE_TITLES: Record<string, { title: string; section: string }> = {
  '/': { title: 'Overview & Analytics', section: 'Operations' },
  '/trips': { title: 'Trips Management', section: 'Logistics' },
  '/users': { title: 'Users Directory', section: 'Trust & KYC' },
  '/admin-accounts': {
    title: 'Admin Accounts',
    section: 'Access & Security',
  },
  '/settings': {
    title: 'Dashboard Settings',
    section: 'Configuration',
  },
};

export function DashboardLayout({
  children,
  onOpenCreateTrip,
}: DashboardLayoutProps) {
  const { currentUser, logout, toast, dismissToast } = useDashboard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const meta = ROUTE_TITLES[location.pathname] || ROUTE_TITLES['/'];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 w-64">
      <div>
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg flex items-center justify-center">
              <img
                src="/assets/aistudio/1793174899099_3f8af047.png"
                alt="Luu Kyone"
                className="h-full w-full object-contain scale-150"
              />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Luu Kyone
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 whitespace-nowrap shrink-0"
              title="Admin Console"
            >
              <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Admin</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary Sidebar" className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">
                {meta.section}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-display text-base font-semibold text-slate-900 truncate">
                {meta.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCreateTrip}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 sm:px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Create Trip</span>
            </button>

            {currentUser && (
              <>
                <div
                  className="hidden sm:block h-6 w-px bg-slate-200"
                  aria-hidden="true"
                />

                <div
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5"
                  title={`${currentUser.name} (${currentUser.email})`}
                >
                  <Avatar
                    src={currentUser.avatarUrl}
                    name={currentUser.name}
                    size="sm"
                  />
                  <div className="hidden md:block text-left min-w-0 max-w-[170px]">
                    <p className="text-xs font-semibold text-slate-900 truncate leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate leading-tight">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void logout()}
                  aria-label="Sign Out"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Inline Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg text-sm text-slate-900"
        >
          <span
            className={`font-medium ${
              toast.tone === 'warning'
                ? 'text-amber-700'
                : toast.tone === 'info'
                  ? 'text-slate-700'
                  : 'text-emerald-700'
            }`}
          >
            {toast.message}
          </span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
