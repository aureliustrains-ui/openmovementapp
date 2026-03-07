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
  // Backward-compatible alias for viewed user.
  user: User | null;
  sessionUser: User | null;
  viewedUser: User | null;
  initialized: boolean;
  impersonating: boolean;
  originalAdmin: User | null;
  login: (user: User) => void;
  logout: () => void;
  initialize: () => Promise<void>;
  impersonate: (client: User) => void;
  stopImpersonating: () => void;
  syncSessionUser: (sessionUser: User) => void;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  sessionUser: null,
  viewedUser: null,
  initialized: false,
  impersonating: false,
  originalAdmin: null,

  login: (user: User) => {
    set({
      user,
      sessionUser: user,
      viewedUser: user,
      initialized: true,
      impersonating: false,
      originalAdmin: null,
    });
  },

  logout: () => {
    set({
      user: null,
      sessionUser: null,
      viewedUser: null,
      initialized: true,
      impersonating: false,
      originalAdmin: null,
    });
  },

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        set({
          user: null,
          sessionUser: null,
          viewedUser: null,
          initialized: true,
          impersonating: false,
          originalAdmin: null,
        });
        return;
      }

      const payload = await response.json();
      const nextUser = payload.user ?? null;
      set({
        user: nextUser,
        sessionUser: nextUser,
        viewedUser: nextUser,
        initialized: true,
        impersonating: false,
        originalAdmin: null,
      });
    } catch {
      set({
        user: null,
        sessionUser: null,
        viewedUser: null,
        initialized: true,
        impersonating: false,
        originalAdmin: null,
      });
    }
  },

  impersonate: (client: User) => {
    const { sessionUser } = get();
    if (sessionUser?.role === 'Admin') {
      set({
        sessionUser,
        viewedUser: client,
        user: client,
        impersonating: true,
        originalAdmin: sessionUser
      });
    }
  },

  stopImpersonating: () => {
    const { impersonating, originalAdmin } = get();
    if (impersonating && originalAdmin) {
      set({
        sessionUser: originalAdmin,
        viewedUser: originalAdmin,
        user: originalAdmin,
        impersonating: false,
        originalAdmin: null
      });
    }
  },

  syncSessionUser: (sessionUser: User) => {
    const { impersonating, originalAdmin } = get();
    if (impersonating && originalAdmin) {
      set({
        sessionUser,
        originalAdmin: sessionUser,
      });
      return;
    }
    set({
      user: sessionUser,
      sessionUser,
      viewedUser: sessionUser,
    });
  },
}));
