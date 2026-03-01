import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usersData } from './mock-data';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string;
}

interface AuthState {
  user: User | null;
  impersonating: boolean;
  originalAdmin: User | null;
  login: (userId: string) => void;
  logout: () => void;
  impersonate: (clientId: string) => void;
  stopImpersonating: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      impersonating: false,
      originalAdmin: null,
      
      login: (userId: string) => {
        const user = usersData.find(u => u.id === userId);
        if (user) {
          set({ user, impersonating: false, originalAdmin: null });
        }
      },
      
      logout: () => {
        set({ user: null, impersonating: false, originalAdmin: null });
      },
      
      impersonate: (clientId: string) => {
        const { user } = get();
        if (user?.role === 'Admin') {
          const client = usersData.find(u => u.id === clientId);
          if (client) {
            set({ 
              user: client, 
              impersonating: true, 
              originalAdmin: user 
            });
          }
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
