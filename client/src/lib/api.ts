import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }
  return res.json();
}

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => fetchApi("/api/users"),
});

export const phasesQuery = queryOptions({
  queryKey: ["phases"],
  queryFn: () => fetchApi("/api/phases"),
});

export function phasesByClientQuery(clientId: string) {
  return queryOptions({
    queryKey: ["phases", clientId],
    queryFn: () => fetchApi(`/api/phases?clientId=${clientId}`),
  });
}

export function phaseQuery(id: string) {
  return queryOptions({
    queryKey: ["phase", id],
    queryFn: () => fetchApi(`/api/phases/${id}`),
  });
}

export const sessionsQuery = queryOptions({
  queryKey: ["sessions"],
  queryFn: () => fetchApi("/api/sessions"),
});

export function sessionsByPhaseQuery(phaseId: string) {
  return queryOptions({
    queryKey: ["sessions", phaseId],
    queryFn: () => fetchApi(`/api/sessions?phaseId=${phaseId}`),
  });
}

export function sessionQuery(id: string) {
  return queryOptions({
    queryKey: ["session", id],
    queryFn: () => fetchApi(`/api/sessions/${id}`),
  });
}

export const exerciseTemplatesQuery = queryOptions({
  queryKey: ["exerciseTemplates"],
  queryFn: () => fetchApi("/api/exercise-templates"),
});

export const sectionTemplatesQuery = queryOptions({
  queryKey: ["sectionTemplates"],
  queryFn: () => fetchApi("/api/section-templates"),
});

export const sessionTemplatesQuery = queryOptions({
  queryKey: ["sessionTemplates"],
  queryFn: () => fetchApi("/api/session-templates"),
});

export const phaseTemplatesQuery = queryOptions({
  queryKey: ["phaseTemplates"],
  queryFn: () => fetchApi("/api/phase-templates"),
});

export function messagesQuery(clientId: string) {
  return queryOptions({
    queryKey: ["messages", clientId],
    queryFn: () => fetchApi(`/api/messages?clientId=${clientId}`),
  });
}

export function workoutLogsQuery(clientId: string) {
  return queryOptions({
    queryKey: ["workoutLogs", clientId],
    queryFn: () => fetchApi(`/api/workout-logs?clientId=${clientId}`),
  });
}

export function chatUnreadQuery(userId: string, role: string) {
  return queryOptions({
    queryKey: ["chatUnread", userId],
    queryFn: () => fetchApi(`/api/chat/unread?userId=${userId}&role=${role}`),
    refetchInterval: 5000,
  });
}

export function useCreatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/phases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["phases"] }); },
  });
}

export function useUpdatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/phases/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["phases"] }); qc.invalidateQueries({ queryKey: ["phase"] }); },
  });
}

export function useDeletePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/phases/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phases"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["workoutLogs"] });
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); qc.invalidateQueries({ queryKey: ["session"] }); },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/messages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["messages", vars.clientId] }); },
  });
}

export function useCreateWorkoutLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/workout-logs", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ["workoutLogs", vars.clientId] }); },
  });
}

export function useCreateExerciseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/exercise-templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exerciseTemplates"] }); },
  });
}

export function useUpdateExerciseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/exercise-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exerciseTemplates"] }); },
  });
}

export function useDeleteExerciseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/exercise-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exerciseTemplates"] }); },
  });
}

export function useCreateSectionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/section-templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sectionTemplates"] }); },
  });
}

export function useUpdateSectionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/section-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sectionTemplates"] }); },
  });
}

export function useDeleteSectionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/section-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sectionTemplates"] }); },
  });
}

export function useCreateSessionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/session-templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessionTemplates"] }); },
  });
}

export function useUpdateSessionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/session-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessionTemplates"] }); },
  });
}

export function useDeleteSessionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/session-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessionTemplates"] }); },
  });
}

export function useCreatePhaseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi("/api/phase-templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["phaseTemplates"] }); },
  });
}

export function useUpdatePhaseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => fetchApi(`/api/phase-templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["phaseTemplates"] }); },
  });
}

export function useDeletePhaseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/phase-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["phaseTemplates"] }); },
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; clientId: string }) =>
      fetchApi("/api/chat/read", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chatUnread"] }); },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      password: string;
      role: "Admin" | "Client";
      status?: string;
      avatar?: string | null;
    }) => fetchApi("/api/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
