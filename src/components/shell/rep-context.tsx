"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Cycle 2: client-only rep selection. Real auth/session arrives in Cycle 6.
const STORAGE_KEY = "wfn:selected-rep";

type RepContextValue = {
  /** The selected rep's name, or null if none chosen. */
  rep: string | null;
  /** True once we've read localStorage — guards against redirect flicker. */
  ready: boolean;
  setRep: (name: string) => void;
  logout: () => void;
};

const RepContext = createContext<RepContextValue | null>(null);

export function RepProvider({ children }: { children: React.ReactNode }) {
  const [rep, setRepState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setRepState(stored);
    } catch {
      // localStorage unavailable (e.g. privacy mode) — run without persistence
    }
    setReady(true);
  }, []);

  const setRep = useCallback((name: string) => {
    setRepState(name);
    try {
      window.localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // ignore persistence failure
    }
  }, []);

  const logout = useCallback(() => {
    setRepState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore persistence failure
    }
  }, []);

  return (
    <RepContext.Provider value={{ rep, ready, setRep, logout }}>
      {children}
    </RepContext.Provider>
  );
}

export function useRep() {
  const ctx = useContext(RepContext);
  if (!ctx) throw new Error("useRep must be used within <RepProvider>");
  return ctx;
}
