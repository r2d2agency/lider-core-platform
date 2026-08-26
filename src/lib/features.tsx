// Client-side feature gate. Lê /auth/me/features e expõe helpers para
// esconder/desabilitar blocos que o template do usuário não libera.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";

export type FeatureAction = "view" | "edit" | "export" | "delete" | "admin";

export interface FeaturesResponse {
  roles: string[];
  features: Record<string, Partial<Record<FeatureAction, boolean>>>;
}

export function useFeatures() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me", "features", user?.id],
    queryFn: () => api<FeaturesResponse>("/auth/me/features"),
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useFeature(featureKey: string, action: FeatureAction = "view"): boolean {
  const q = useFeatures();
  // Enquanto carrega, mantemos a UI estável; em erro, falhamos fechado.
  if (q.isLoading) return true;
  if (!q.data) return false;
  return !!q.data.features?.[featureKey]?.[action];
}

export function Feature({
  featureKey,
  action = "view",
  fallback = null,
  children,
}: {
  featureKey: string;
  action?: FeatureAction;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = useFeature(featureKey, action);
  return <>{allowed ? children : fallback}</>;
}
