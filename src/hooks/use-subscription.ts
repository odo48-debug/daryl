import { useAuth } from "@clerk/nextjs";

export type FeaturePermission = "editCode" | "createProjects" | "videoDownload";

// Mapeo de características a los planes que tienen acceso
const featurePermissions: Record<FeaturePermission, string[]> = {
  editCode: ["pro"],
  createProjects: ["free", "pro"],
  videoDownload: ["pro"]
};

export function useSubscription() {
  const { has } = useAuth();
  const hasPro = has?.({ plan: "pro" }) || false;

  // Verifica si el usuario puede usar una característica específica
  const canUseFeature = (feature: FeaturePermission): boolean => {
    const allowedPlans = featurePermissions[feature];
    
    // Si el usuario tiene Pro, tiene acceso a todas las características
    if (hasPro) return true;
    
    // Si no tiene Pro, solo tiene acceso a características marcadas como "free"
    return allowedPlans.includes("free");
  };

  return {
    hasPro,
    canUseFeature,
    // Helper methods para verificaciones específicas
    canEditCode: () => canUseFeature("editCode"),
    canCreateProjects: () => canUseFeature("createProjects"),
    canDownloadVideos: () => canUseFeature("videoDownload"),
  };
}
