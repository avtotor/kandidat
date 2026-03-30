import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

// --- API Error Parser Helper ---
async function handleResponse(res: Response, schema: any) {
  if (!res.ok) {
    let errorMsg = "API Error";
    try {
      const errData = await res.json();
      errorMsg = errData.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  const data = await res.json();
  return schema.parse(data);
}

// --- HOOKS ---

export function useCreateSession() {
  return useMutation({
    mutationFn: async (input: z.infer<typeof api.sessions.create.input>) => {
      const res = await fetch(api.sessions.create.path, {
        method: api.sessions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return handleResponse(res, api.sessions.create.responses[201]);
    },
  });
}

export function useSubmitAnswer() {
  return useMutation({
    mutationFn: async ({ sessionId, questionId, selectedIndex, timeSpentSec }: { sessionId: number, questionId: number, selectedIndex: number, timeSpentSec?: number }) => {
      const url = buildUrl(api.answers.submit.path, { id: sessionId });
      const body: { questionId: number; selectedIndex: number; timeSpentSec?: number } = { questionId, selectedIndex };
      if (timeSpentSec != null) body.timeSpentSec = timeSpentSec;
      const res = await fetch(url, {
        method: api.answers.submit.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return handleResponse(res, api.answers.submit.responses[201]);
    }
  });
}

export function useUpdateSessionStatus() {
  return useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: number, status: 'completed' }) => {
      const url = buildUrl(api.sessions.updateStatus.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      return handleResponse(res, api.sessions.updateStatus.responses[200]);
    }
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, firstName, lastName, phone }: { sessionId: number; firstName: string; lastName: string; phone: string }) => {
      const url = buildUrl(api.sessions.updateCandidate.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.updateCandidate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      return handleResponse(res, api.sessions.updateCandidate.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dashboard.list.path] });
    },
  });
}

export function useUploadResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, file, fileName }: { sessionId: number; file: string; fileName: string }) => {
      const url = buildUrl(api.sessions.uploadResume.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.uploadResume.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, fileName }),
      });
      return handleResponse(res, api.sessions.uploadResume.responses[200]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dashboard.list.path] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: number }) => {
      const url = buildUrl(api.sessions.delete.path, { id: sessionId });
      const res = await fetch(url, {
        method: api.sessions.delete.method,
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete session");
      }
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dashboard.list.path] });
    },
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: [api.dashboard.list.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.list.path);
      return handleResponse(res, api.dashboard.list.responses[200]);
    },
    refetchInterval: 1000, // Poll every 1 second
  });
}

export function useQuestionCounts() {
  return useQuery({
    queryKey: [api.questions.counts.path],
    queryFn: async () => {
      const res = await fetch(api.questions.counts.path);
      return handleResponse(res, api.questions.counts.responses[200]);
    },
  });
}
