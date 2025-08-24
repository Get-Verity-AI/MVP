// miniapp/src/lib/api.ts
import axios, { AxiosError } from "axios";

/** Resolve backend base URL with sensible default in dev */
export const API_BASE: string =
  (import.meta.env.VITE_BACKEND_URL as string) || "http://localhost:8000";

/** Shared axios instance */
export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  // helps surface "failed to fetch" earlier
  timeout: 15000,
});

/** Interceptors: normalize errors so UI can show helpful messages */
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    // Network / CORS / DNS / server down
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return Promise.reject(new Error("Request timed out. Is the backend running?"));
    }
    if (!err.response) {
      return Promise.reject(
        new Error(
          "Network error / CORS: could not reach backend. " +
            "Check VITE_BACKEND_URL and backend CORS ALLOWED_ORIGINS."
        )
      );
    }
    // HTTP error with JSON body
    const data = err.response.data as any;
    const detail = data?.detail || data?.error || data?.message;
    return Promise.reject(new Error(detail || `HTTP ${err.response.status}`));
  }
);

/** -------- Legacy miniapp script endpoints (kept for compatibility) -------- */
export type LegacyStep =
  | { id: string; type: "text"; prompt: string; next?: string | null; required?: boolean }
  | { id: string; type: "input_text"; prompt: string; next?: string | null; required?: boolean }
  | {
      id: string;
      type: "input_scale";
      prompt: string;
      min?: number | null;
      max?: number | null;
      next?: string | null;
      required?: boolean;
    }
  | { id: string; type: "input_email"; prompt: string; next?: string | null; required?: boolean };

export interface Script {
  session_id: string;
  domain: string;
  value_prop: string;
  target_action: string;
  steps: LegacyStep[];
}

/** Old path used by legacy flow */
export async function fetchScript(sessionId: string): Promise<Script> {
  const { data } = await api.get("/script", { params: { session_id: sessionId } });
  return data as Script;
}

/**
 * Legacy submit helper:
 * - Your backend exposes `/response` (singular) and `/responses_sb` (Supabase).
 * - If you were calling `/responses` before, that would 404. Use one of these:
 */
export async function postResponseFile(payload: {
  session_id: string;
  respondent_id: string;
  answers: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const { data } = await api.post("/response", payload); // <- alias to file-mode
  return data;
}

/** New Supabase flow submit */
export async function postResponsesSB(payload: {
  session_id: string;
  tester_email?: string;
  tester_handle?: string;
  answers: Record<string, unknown>;
}): Promise<{ ok: boolean; hashes: { sha256: string; keccak: string } }> {
  const { data } = await api.post("/responses_sb", payload);
  return data;
}

/** ---------------- Founder dashboard & responses ---------------- */
export async function fetchFounderSessions(founder_email: string) {
  const { data } = await api.get("/founder_sessions", {
    params: { founder_email: (founder_email || "").trim().toLowerCase() },
  });
  return data as {
    sessions: Array<{
      id: string;
      created_at: string;
      status: string | null;
      responses_count: number;
      last_response_at: string | null;
    }>;
  };
}

export async function fetchSessionResponses(
  session_id: string,
  opts?: { tester?: string; include_answers?: boolean }
) {
  const params: Record<string, any> = { session_id };
  if (opts?.tester) params.tester_email = (opts.tester || "").trim().toLowerCase();
  if (opts?.include_answers) params.include_answers = true;

  const { data } = await api.get("/session_responses", { params });
  return data as {
    session_id: string;
    responses: Array<{
      id: string;
      created_at: string;
      answer_hash: string;
      tester_email?: string | null;
      tester_handle?: string | null;
      preview: string;
      answers: Record<string, unknown> | null;
    }>;
  };
}

/** Useful for Respond.tsx */
export async function fetchSessionQuestions(session_id: string) {
  const { data } = await api.get("/session_questions", { params: { session_id } });
  return data as { session_id: string; steps: any[] };
}

export async function fetchSummarySB(session_id: string) {
  const { data } = await api.get("/summary_sb", { params: { session_id } });
  return data as { session_id: string; responses_count: number; first_ts: string | null; last_ts: string | null };
}

/** Health check helper for debugging “failed to fetch” */
export async function pingHealth() {
  const { data } = await api.get("/health");
  return data as any;
}
