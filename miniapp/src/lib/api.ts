import axios from "axios";

export const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

// shared axios instance
export const api = axios.create({
  baseURL: API_BASE,
  headers: { "content-type": "application/json" },
});

// ----- Legacy miniapp script endpoints -----
export type Step =
  | { id: string; type: "text"; prompt: string; next?: string | null; required?: boolean }
  | { id: string; type: "input_text"; prompt: string; next?: string | null; required?: boolean }
  | { id: string; type: "input_scale"; prompt: string; min?: number | null; max?: number | null; next?: string | null; required?: boolean }
  | { id: string; type: "input_email"; prompt: string; next?: string | null; required?: boolean };

export interface Script {
  session_id: string;
  domain: string;
  value_prop: string;
  target_action: string;
  steps: Step[];
}

export async function fetchScript(sessionId: string): Promise<Script> {
  const { data } = await axios.get(`${API_BASE}/script`, { params: { session_id: sessionId } });
  return data as Script;
}

export async function postResponse(payload: {
  session_id: string;
  respondent_id: string;
  answers: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const { data } = await axios.post(`${API_BASE}/responses`, payload, {
    headers: { "content-type": "application/json" },
  });
  return data;
}

// ----- New: Founder dashboard -----
export async function fetchFounderSessions(founder_email: string) {
  const { data } = await api.get("/founder_sessions", { params: { founder_email } });
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

//Frontend: responses page (table with columns, click preview to open full)
export async function fetchSessionResponses(
  session_id: string,
  opts?: { tester?: string; include_answers?: boolean }
) {
  const params: Record<string, any> = { session_id };
  if (opts?.tester) params.tester_email = opts.tester;
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
