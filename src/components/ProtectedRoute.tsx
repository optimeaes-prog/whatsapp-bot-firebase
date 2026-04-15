import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageLoading } from "./ui/PageLoading";
import { useEffect, useState } from "react";
import { getOrganizationSettings } from "../services/organization";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user) {
      getOrganizationSettings().then((settings) => {
        // We consider onboarding completed if onboardingStep >= 6 or onboardingCompleted is explicitly true.
        const isCompleted = (settings.onboardingStep || 0) >= 6;
        setOnboardingCompleted(isCompleted);
        setChecking(false);
      }).catch((err) => {
        console.error("Error checking onboarding status", err);
        setOnboardingCompleted(true); // Fallback so we don't lock the user out if DB fails
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [user]);

  if (authLoading || (user && checking)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoading message={authLoading ? "Cargando sesión..." : "Verificando conexión..."} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force onboarding if not completed and we are not already on the onboarding or billing routes
  if (onboardingCompleted === false && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
