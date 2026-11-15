import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { canAccessAdminDashboard } from './utils/analytics';
import { DashboardLayout } from './components/DashboardLayout';
import { TripFormModal } from './components/TripFormModal';
import { AdminAccountsPage } from './pages/AdminAccountsPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TripsPage } from './pages/TripsPage';
import { UsersPage } from './pages/UsersPage';

function AdminAppShell() {
  const { currentUser, users, addTrip, loginDemoAdmin } = useDashboard();
  const [createTripOpen, setCreateTripOpen] = useState(false);
  const autostartTriggered = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('autostart') === '1' &&
      !currentUser &&
      !autostartTriggered.current
    ) {
      autostartTriggered.current = true;
      void loginDemoAdmin();
    }
  }, [currentUser, loginDemoAdmin]);

  if (!canAccessAdminDashboard(currentUser)) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout onOpenCreateTrip={() => setCreateTripOpen(true)}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route
          path="/trips"
          element={<TripsPage onOpenCreateModal={() => setCreateTripOpen(true)} />}
        />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/admin-accounts" element={<AdminAccountsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <TripFormModal
        open={createTripOpen}
        users={users}
        onClose={() => setCreateTripOpen(false)}
        onSubmit={async (input) => {
          await addTrip(input);
        }}
      />
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <AdminAppShell />
      </DashboardProvider>
    </BrowserRouter>
  );
}
