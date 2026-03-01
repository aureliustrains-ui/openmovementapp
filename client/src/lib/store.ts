import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  usersData as initialUsers,
  phasesData as initialPhases,
  sessionsData as initialSessions,
  clientLogsData as initialLogs,
  chatsData as initialChats
} from './mock-data';

interface DataState {
  users: typeof initialUsers;
  phases: typeof initialPhases;
  sessions: typeof initialSessions;
  logs: typeof initialLogs;
  chats: typeof initialChats;

  // Actions
  updatePhaseStatus: (phaseId: string, status: string) => void;
  updatePhaseName: (phaseId: string, name: string) => void;
  updateMovementCheck: (phaseId: string, exerciseId: string, status: string, videoUrl?: string, feedback?: string) => void;
  addMessage: (clientId: string, sender: string, text: string, isClient: boolean) => void;
  toggleSessionComplete: (sessionId: string, instanceId: string) => void;
  addLog: (log: any) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      users: initialUsers,
      phases: initialPhases,
      sessions: initialSessions,
      logs: initialLogs,
      chats: initialChats,

      updatePhaseStatus: (phaseId, status) => set((state) => ({
        phases: state.phases.map(p => p.id === phaseId ? { ...p, status } : p)
      })),

      updatePhaseName: (phaseId, name) => set((state) => ({
        phases: state.phases.map(p => p.id === phaseId ? { ...p, name } : p)
      })),

      updateMovementCheck: (phaseId, exerciseId, status, videoUrl, feedback) => set((state) => ({
        phases: state.phases.map(p => {
          if (p.id !== phaseId) return p;
          return {
            ...p,
            movementChecks: p.movementChecks.map(mc => {
              if (mc.exerciseId !== exerciseId) return mc;
              return {
                ...mc,
                status,
                ...(videoUrl !== undefined && { videoUrl }),
                ...(feedback !== undefined && { feedback })
              };
            })
          };
        })
      })),

      addMessage: (clientId, sender, text, isClient) => set((state) => {
        const newMessage = {
          id: `msg_${Date.now()}`,
          clientId,
          sender,
          text,
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          isClient
        };
        return { chats: [...state.chats, newMessage] };
      }),

      toggleSessionComplete: (sessionId, instanceId) => set((state) => ({
        sessions: state.sessions.map(s => {
          if (s.id !== sessionId) return s;
          const isComplete = s.completedInstances?.includes(instanceId);
          return {
            ...s,
            completedInstances: isComplete 
              ? s.completedInstances.filter(id => id !== instanceId)
              : [...(s.completedInstances || []), instanceId]
          };
        })
      })),

      addLog: (log) => set((state) => ({
        logs: [...state.logs.filter(l => !(l.instanceId === log.instanceId && l.exerciseId === log.exerciseId)), log]
      })),
    }),
    {
      name: 'nexus-data-storage',
    }
  )
);
