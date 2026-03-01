import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
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

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); },
  });
}
