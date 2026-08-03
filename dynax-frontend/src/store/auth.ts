import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ensureFreshSession, tokenStore } from '@/lib/api';
import { authService } from '@/lib/auth';
import { User, UserRole, ProfessionalProfile, PatientProfile } from '@/types';

interface AuthState {
  user: User | null;
  profile: ProfessionalProfile | PatientProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** True once initializeAuth() has finished a launch. Never persisted. */
  isInitialized: boolean;

  setUser: (user: User | null) => void;
  setProfile: (profile: ProfessionalProfile | PatientProfile | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  /** Restores the session on startup. Resolves true when signed in. */
  initializeAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (isLoading) => set({ isLoading }),
      clearAuth: () => set({ user: null, profile: null, isAuthenticated: false }),

      initializeAuth: async () => {
        if (typeof window === 'undefined') return false;
        // Runs once per launch; later callers just read the settled state.
        if (get().isInitialized) return get().isAuthenticated;

        set({ isLoading: true });
        try {
          const signedIn = await ensureFreshSession();

          if (!signedIn) {
            set({ user: null, profile: null, isAuthenticated: false });
            return false;
          }

          set({ isAuthenticated: true });

          // The persisted store usually rehydrates the user already; only fetch
          // when it's missing so a reopen doesn't wait on the network.
          if (!get().user) {
            try {
              const me = await authService.me();
              set({
                user: {
                  id: me.user_id,
                  email: me.email,
                  role: (me.role || tokenStore.getRole() || 'patient') as UserRole,
                  is_active: true,
                  created_at: '',
                  updated_at: '',
                },
              });
            } catch {
              // Token is valid; the profile can be filled in by page queries.
            }
          }
          return true;
        } finally {
          set({ isLoading: false, isInitialized: true });
        }
      },
    }),
    {
      name: 'dynax-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Notification store
interface NotificationState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrementUnread: () => void;
  clearUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  decrementUnread: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  clearUnread: () => set({ unreadCount: 0 }),
}));
