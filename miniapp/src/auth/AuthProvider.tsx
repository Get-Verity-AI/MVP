import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AuthCtx = { ready: boolean; user: any | null };
const Ctx = createContext<AuthCtx>({ ready: false, user: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    // If the client isn't configured, don't crash. Mark ready and unauthenticated.
    if (!supabase) {
      setReady(true);
      setUser(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setUser(session?.user ?? null);
        setReady(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={{ ready, user }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
