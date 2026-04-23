import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

type AuthContextValue = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * FIX #5: Provide auth state via React Context so all components share
 * the same auth instance instead of creating independent state per hook call.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}

// Alias for drop-in replacement of useAuth() calls
export { useAuthContext as useAuth };
