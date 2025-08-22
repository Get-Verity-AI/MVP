import axios from "axios";
export const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
export const api = axios.create({ baseURL: API_BASE, headers: { "content-type": "application/json" }});

const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface Step {
  id: string;
  type: "text" | "input_text" | "input_scale" | "input_email";
  prompt: string;
  next?: string | null;
  min?: number | null;
  max?: number | null;
  required?: boolean;
}

export interface Script {
  session_id: string;
  domain: string;
  value_prop: string;
  target_action: string;
  steps: Step[];
}

export async function fetchScript(sessionId: string): Promise<Script> {
  const { data } = await axios.get(`${BASE}/script`, { params: { session_id: sessionId } });
  return data as Script;
}

export async function postResponse(payload: {
  session_id: string;
  respondent_id: string;
  answers: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const { data } = await axios.post(`${BASE}/responses`, payload, {
    headers: { "content-type": "application/json" },
  });
  return data;
}
