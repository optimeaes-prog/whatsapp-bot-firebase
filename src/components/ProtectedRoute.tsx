import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageLoading } from "./ui/PageLoading";

export function ProtectedRoute({
  children,
  requiredRoles,
}: {
  children: React.ReactNode;
  requiredRoles?: string[];
}) {
  const { user, loading: authLoading, organizationId, role } = useAuth();
  if (authLoading || (user && !organizationId)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoading message={authLoading ? "Cargando sesión..." : "Verificando conexión..."} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
