import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

if (url && key) {
  client = createClient(url, key);
} else {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in miniapp/.env. " +
    "Auth is disabled; pages should still render."
  );
}

export const supabase = client;
