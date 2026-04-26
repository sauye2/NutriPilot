"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthContextValue = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadingFallback = window.setTimeout(() => {
      if (!mounted) {
        return;
      }

      setIsLoading(false);
    }, 2500);

    const hydrate = async () => {
      const {
        data: { session: activeSession },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);
      window.clearTimeout(loadingFallback);
      setIsLoading(false);
    };

    void hydrate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      window.clearTimeout(loadingFallback);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingFallback);
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ supabase, session, user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    return {
      supabase: createBrowserSupabaseClient(),
      session: null,
      user: null,
      isLoading: false,
    };
  }

  return context;
}
