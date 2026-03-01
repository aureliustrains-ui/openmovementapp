import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  impersonating: boolean;
  originalAdmin: User | null;
  login: (user: User) => void;
  logout: () => void;
  impersonate: (client: User) => void;
  stopImpersonating: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      impersonating: false,
      originalAdmin: null,
      
      login: (user: User) => {
        set({ user, impersonating: false, originalAdmin: null });
      },
      
      logout: () => {
        set({ user: null, impersonating: false, originalAdmin: null });
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
    }),
    {
      name: 'nexus-auth-storage',
    }
  )
);
