import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { canAccessAdminDashboard } from './utils/analytics';
import { DashboardLayout } from './components/DashboardLayout';
import { TripFormModal } from './components/TripFormModal';
import { LoginPage } from './pages/LoginPage';
import { ModerationPage } from './pages/ModerationPage';
import { OverviewPage } from './pages/OverviewPage';
import { TripsPage } from './pages/TripsPage';
import { UsersPage } from './pages/UsersPage';

function AdminAppShell() {
  const { currentUser, users, addTrip, loginDemoAdmin } = useDashboard();
  const [createTripOpen, setCreateTripOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !currentUser) {
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
        <Route path="/moderation" element={<ModerationPage />} />
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
