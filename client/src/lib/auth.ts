import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  initialized: boolean;
  impersonating: boolean;
  originalAdmin: User | null;
  login: (user: User) => void;
  logout: () => void;
  initialize: () => Promise<void>;
  impersonate: (client: User) => void;
  stopImpersonating: () => void;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  initialized: false,
  impersonating: false,
  originalAdmin: null,

  login: (user: User) => {
    set({ user, initialized: true, impersonating: false, originalAdmin: null });
  },

  logout: () => {
    set({ user: null, initialized: true, impersonating: false, originalAdmin: null });
  },

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        set({ user: null, initialized: true, impersonating: false, originalAdmin: null });
        return;
      }

      const payload = await response.json();
      set({ user: payload.user ?? null, initialized: true, impersonating: false, originalAdmin: null });
    } catch {
      set({ user: null, initialized: true, impersonating: false, originalAdmin: null });
    }
  },

  impersonate: (client: User) => {
    const { user } = get();
    if (user?.role === 'Admin') {
      set({
        user: client,
        impersonating: true,
        originalAdmin: user
      });
    }
  },

  stopImpersonating: () => {
    const { impersonating, originalAdmin } = get();
    if (impersonating && originalAdmin) {
      set({
        user: originalAdmin,
        impersonating: false,
        originalAdmin: null
      });
    }
  }
}));
