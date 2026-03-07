import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

const configuredApiBaseUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : "";

function getDefaultDevApiOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:5099";
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:5099`;
}

const devApiFallbackOrigin =
  typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? String(import.meta.env?.VITE_DEV_API_ORIGIN || getDefaultDevApiOrigin()).trim()
    : "";

function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (!configuredApiBaseUrl) {
    return url;
  }
  return new URL(url, configuredApiBaseUrl).toString();
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("application/json");
}

async function readBodyPreview(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return "<empty>";
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function formatHttpPrefix(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`;
}

class ApiResponseError extends Error {
  readonly kind: "non_json" | "invalid_json" | "http_error";
  readonly status: number;

  constructor(message: string, kind: "non_json" | "invalid_json" | "http_error", status: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

async function parseJsonOrThrow(res: Response, method: string, url: string) {
  const contentType = res.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    const preview = await readBodyPreview(res);
    throw new ApiResponseError(
      `${formatHttpPrefix(method, url)} returned non-JSON (${contentType || "unknown"}), status=${res.status}, bodyPreview=${preview}`,
      "non_json",
      res.status,
    );
  }
  try {
    return await res.json();
  } catch (error) {
    throw new ApiResponseError(
      `${formatHttpPrefix(method, url)} returned invalid JSON, status=${res.status}, parseError=${error instanceof Error ? error.message : "unknown"}`,
      "invalid_json",
      res.status,
    );
  }
}

async function requestJson(url: string, method: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    if (isJsonContentType(res.headers.get("content-type"))) {
      try {
        const body = await res.json();
        const apiMessage =
          body && typeof body.message === "string" && body.message.length > 0
            ? body.message
            : `API Error: ${res.status}`;
        throw new ApiResponseError(
          `${formatHttpPrefix(method, url)} failed (${res.status}): ${apiMessage}`,
          "http_error",
          res.status,
        );
      } catch (error) {
        if (error instanceof Error) throw error;
      }
    }
    const preview = await readBodyPreview(res);
    throw new ApiResponseError(
      `${formatHttpPrefix(method, url)} failed (${res.status}) with non-JSON response (${res.headers.get("content-type") || "unknown"}), bodyPreview=${preview}`,
      "non_json",
      res.status,
    );
  }
  if (res.status === 204) {
    return null;
  }
  return parseJsonOrThrow(res, method, url);
}

function shouldRetryWithDevFallback(url: string, resolvedUrl: string, error: unknown): boolean {
  if (!(error instanceof ApiResponseError)) return false;
  if (error.kind !== "non_json") return false;
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return false;
  if (!devApiFallbackOrigin) return false;
  if (!url.startsWith("/api/")) return false;
  if (/^https?:\/\//i.test(url)) return false;
  try {
    const original = new URL(resolvedUrl, window.location.origin).origin;
    const fallback = new URL(devApiFallbackOrigin).origin;
    return original !== fallback;
  } catch {
    return true;
  }
}

function resolveDevFallbackUrl(url: string): string | null {
  if (!devApiFallbackOrigin) return null;
  try {
    return new URL(url, devApiFallbackOrigin).toString();
  } catch {
    return null;
  }
}

function getBrowserOriginForMessage(): string {
  if (typeof window === "undefined") return "unknown-origin";
  return window.location.origin;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && /fetch/i.test(error.message);
}

async function fetchApi(url: string, options?: RequestInit) {
  const method = options?.method ?? "GET";
  const resolvedUrl = resolveApiUrl(url);
  try {
    return await requestJson(resolvedUrl, method, options);
  } catch (error) {
    if (isNetworkError(error)) {
      throw new Error(
        `${formatHttpPrefix(method, url)} failed to reach API from ${getBrowserOriginForMessage()}. If you are on a Vite page, ensure backend is running and /api is proxied.`,
      );
    }
    if (!shouldRetryWithDevFallback(url, resolvedUrl, error)) {
      throw error;
    }
    const fallbackUrl = resolveDevFallbackUrl(url);
    if (!fallbackUrl) {
      throw error;
    }
    try {
      return await requestJson(fallbackUrl, method, options);
    } catch (fallbackError) {
      const primaryMessage = error instanceof Error ? error.message : "unknown primary API error";
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "unknown fallback API error";
      throw new Error(
        `${primaryMessage}; retry via ${fallbackUrl} also failed: ${fallbackMessage}`,
      );
    }
  }
}

async function fetchApiForm(url: string, options?: RequestInit) {
  const method = options?.method ?? "GET";
  const resolvedUrl = resolveApiUrl(url);
  const res = await fetch(resolvedUrl, { credentials: "include", ...options });
  if (!res.ok) {
    if (isJsonContentType(res.headers.get("content-type"))) {
      try {
        const body = await res.json();
        const apiMessage =
          body && typeof body.message === "string" && body.message.length > 0
            ? body.message
            : `API Error: ${res.status}`;
        throw new ApiResponseError(
          `${formatHttpPrefix(method, url)} failed (${res.status}): ${apiMessage}`,
          "http_error",
          res.status,
        );
      } catch (error) {
        if (error instanceof Error) throw error;
      }
    }
    const preview = await readBodyPreview(res);
    throw new ApiResponseError(
      `${formatHttpPrefix(method, url)} failed (${res.status}) with non-JSON response (${res.headers.get("content-type") || "unknown"}), bodyPreview=${preview}`,
      "non_json",
      res.status,
    );
  }
  if (res.status === 204) return null;
  return parseJsonOrThrow(res, method, url);
}

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: () => fetchApi("/api/users"),
});

export const myProfileQuery = queryOptions({
  queryKey: ["myProfile"],
  queryFn: () => fetchApi("/api/me"),
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

export function phaseTemplateQuery(id: string) {
  return queryOptions({
    queryKey: ["phaseTemplate", id],
    queryFn: () => fetchApi(`/api/phase-templates/${id}`),
  });
}

export function messagesQuery(clientId: string) {
  return queryOptions({
    queryKey: ["messages", clientId],
    queryFn: () => fetchApi(`/api/messages?clientId=${clientId}`),
  });
}

export function clientSpecificsQuery(clientId: string) {
  return queryOptions({
    queryKey: ["clientSpecifics", clientId],
    queryFn: () => fetchApi(`/api/clients/${clientId}/specifics`),
  });
}

export function workoutLogsQuery(clientId: string) {
  return queryOptions({
    queryKey: ["workoutLogs", clientId],
    queryFn: () => fetchApi(`/api/workout-logs?clientId=${clientId}`),
  });
}

export const sessionCheckinsMeQuery = queryOptions({
  queryKey: ["sessionCheckins", "me"],
  queryFn: () => fetchApi("/api/session-checkins/me"),
});

export const weeklyCheckinsMeQuery = queryOptions({
  queryKey: ["weeklyCheckins", "me"],
  queryFn: () => fetchApi("/api/weekly-checkins/me"),
});

export const weeklyCheckinsCurrentOrDueQuery = queryOptions({
  queryKey: ["weeklyCheckins", "currentOrDue"],
  queryFn: () => fetchApi("/api/weekly-checkins/me/current-or-due"),
});

export function clientCheckinsSummaryQuery(clientId: string) {
  return queryOptions({
    queryKey: ["clientCheckinsSummary", clientId],
    queryFn: () => fetchApi(`/api/clients/${clientId}/checkins/summary`),
  });
}

export function clientCheckinsTrendsQuery(clientId: string, range: string) {
  return queryOptions({
    queryKey: ["clientCheckinsTrends", clientId, range],
    queryFn: () => fetchApi(`/api/clients/${clientId}/checkins/trends?range=${encodeURIComponent(range)}`),
  });
}

export function clientCheckinsRecentQuery(clientId: string) {
  return queryOptions({
    queryKey: ["clientCheckinsRecent", clientId],
    queryFn: () => fetchApi(`/api/clients/${clientId}/checkins/recent`),
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
    mutationFn: (data: { clientId: string; text: string }) =>
      fetchApi("/api/messages", {
        method: "POST",
        body: JSON.stringify({ clientId: data.clientId, text: data.text }),
      }),
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

export function useCreateSessionCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      rpeOverall: number;
      feltOff?: boolean;
      feltOffNote?: string | null;
    }) => fetchApi("/api/session-checkins", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessionCheckins"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsSummary"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsTrends"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsRecent"] });
    },
  });
}

export function useCreateWeeklyCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sleepWeek: number;
      energyWeek: number;
      injuryAffectedTraining: boolean;
      injuryImpact?: number | null;
      coachNoteFromClient?: string | null;
    }) => fetchApi("/api/weekly-checkins", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyCheckins"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsSummary"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsTrends"] });
      qc.invalidateQueries({ queryKey: ["clientCheckinsRecent"] });
    },
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

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      email?: string;
      avatar?: string | null;
      bio?: string | null;
      height?: string | null;
      weight?: string | null;
      goals?: string | null;
      infos?: string | null;
    }) => fetchApi("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myProfile"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useUploadMyAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      return fetchApiForm("/api/me/avatar", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myProfile"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateClientSpecifics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      specifics,
    }: {
      clientId: string;
      specifics: string | null;
    }) =>
      fetchApi(`/api/clients/${clientId}/specifics`, {
        method: "PATCH",
        body: JSON.stringify({ specifics }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["clientSpecifics", vars.clientId] });
    },
  });
}
