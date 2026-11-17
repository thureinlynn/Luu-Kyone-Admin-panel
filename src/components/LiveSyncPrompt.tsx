import { Database, LogIn } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export function LiveSyncPrompt() {
  const {
    currentUser,
    isLiveFirestore,
    firebaseConnected,
    authLoading,
    loginWithGoogle,
  } = useDashboard();

  if (!firebaseConnected || isLiveFirestore) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-xs text-amber-950">
      <div className="flex items-start gap-2.5 min-w-0">
        <Database
          className="h-4 w-4 text-amber-700 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-semibold text-amber-950">
            Sign in with Google to view live trips &amp; users
          </p>
          <p className="mt-0.5 text-amber-900/90 leading-relaxed">
            You entered via offline Instant Admin mode. Authenticate as{' '}
            <span className="font-mono font-medium">
              {currentUser?.email || 'thureinlynn.mm@gmail.com'}
            </span>{' '}
            to stream real-time Luu Kyone trips and user profiles from Firestore.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={authLoading}
        onClick={() =>
          void loginWithGoogle(currentUser?.email || 'thureinlynn.mm@gmail.com')
        }
        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors self-start sm:self-center whitespace-nowrap shrink-0"
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {authLoading ? 'Connecting...' : 'Connect Live with Google'}
        </span>
      </button>
    </div>
  );
}
