import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { CollabProvider } from "./contexts/CollabContext";
import { CookieConsentProvider } from "./contexts/CookieConsentContext";
import { CookieBanner } from "./components/CookieBanner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { SignupInvitation } from "./pages/SignupInvitation";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { Listings } from "./pages/Listings";
import { Captaciones } from "./pages/Captaciones";
import { Leads } from "./pages/Leads";
import { Seguimiento } from "./pages/Seguimiento";
import { SeguimientoTareas } from "./pages/SeguimientoTareas";
import { Conversations } from "./pages/Conversations";
import { Notificaciones } from "./pages/Notificaciones";

import { Alerts } from "./pages/Alerts";
import { Configuracion } from "./pages/Configuracion";
import { AuditLog } from "./pages/AuditLog";
import { MarketingLanding } from "./pages/MarketingLanding";
import { MarketingLandingV2 } from "./pages/MarketingLandingV2";
import { Users } from "./pages/Users";
import { Subscription } from "./pages/Subscription";
import { Onboarding } from "./pages/Onboarding";
import { ConnectWhatsApp } from "./pages/ConnectWhatsApp";
import { DeletionStatus } from "./pages/DeletionStatus";
import { AdminOnboards } from "./pages/AdminOnboards";
import { AdminTools } from "./pages/AdminTools";
import { AdminTwilioMigration } from "./pages/AdminTwilioMigration";
import { LegalDoc } from "./pages/LegalDoc";
import { WhatsAppAnimationLab } from "./pages/WhatsAppAnimationLab";
import { WhatsAppLeadsAnimation } from "./pages/WhatsAppLeadsAnimation";
import FontGallery from "./pages/FontGallery";
import EmailGallery from "./pages/EmailGallery";
import EmailPreferences from "./pages/EmailPreferences";
import LeadsInactivos from "./pages/LeadsInactivos";
import { Organizacion } from "./pages/Organizacion";
import { BotTest } from "./pages/BotTest";
import { Usage } from "./pages/Usage";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePageTracking } from "./hooks/usePageTracking";
import { analytics } from "./lib/analytics";

const queryClient = new QueryClient();

function PageTracker() {
  usePageTracking();
  return null;
}

/** Catch-all route: track that an unknown path was attempted, then send the
 * user to /dashboard (which itself redirects to /login if unauthenticated). */
function NotFoundRedirect() {
  const location = useLocation();
  useEffect(() => {
    analytics.trackNotFoundHit(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return <Navigate to="/dashboard" replace />;
}

/** Legacy /cualificados links: forward to Leads with filters, preserving ?ad= */
function CualificadosRedirect() {
  const [searchParams] = useSearchParams();
  const ad = searchParams.get("ad");
  const qs = new URLSearchParams();
  qs.set("status", "qualified");
  if (ad) qs.set("ad", ad);
  return <Navigate to={`/leads?${qs.toString()}`} replace />;
}

const FONT_STACKS_URLS: Record<string, string> = {
  "modern-leader": "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500&display=swap",
  "sharp-geometric": "https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&family=Sora:wght@600;700&family=Public+Sans:wght@400;500&display=swap",
  "friendly-saas": "https://fonts.googleapis.com/css2?family=Lexend:wght@700;800&family=Manrope:wght@600;700&family=Figtree:wght@400;500&display=swap",
  "sophisticated-tech": "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,700&family=IBM+Plex+Sans:wght@600;700&family=Urbanist:wght@400;500&display=swap",
  "bold-contemporary": "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Grotesk:wght@600;700&family=Work+Sans:wght@400;500&display=swap",
  "classic-professional": "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Ubuntu:wght@500;700&family=Roboto:wght@400;500&display=swap"
};

function App() {
  useEffect(() => {
    // Restore fonts from localStorage
    const special = localStorage.getItem("font_special");
    const heading = localStorage.getItem("font_heading");
    const body = localStorage.getItem("font_body");
    const activeStackId = localStorage.getItem("active_font_stack");

    if (special && heading && body && activeStackId) {
      const root = document.documentElement;
      root.style.setProperty("--font-special", `'${special}', sans-serif`);
      root.style.setProperty("--font-heading", `'${heading}', sans-serif`);
      root.style.setProperty("--font-body", `'${body}', sans-serif`);
      document.body.style.fontFamily = `'${body}', sans-serif`;

      // Load fonts if they are from our predefined stacks
      const stack = FONT_STACKS_URLS[activeStackId];
      if (stack && !document.getElementById(`font-link-${activeStackId}`)) {
        const link = document.createElement("link");
        link.id = `font-link-${activeStackId}`;
        link.rel = "stylesheet";
        link.href = stack;
        document.head.appendChild(link);
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CookieConsentProvider>
      <AuthProvider>
        <CollabProvider>
        <BrowserRouter>
          <PageTracker />
          <CookieBanner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/registro" element={<Navigate to="/signup" replace />} />
            <Route path="/invite" element={<SignupInvitation />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/email-preferences" element={<EmailPreferences />} />
            <Route path="/leads-inactivos" element={<LeadsInactivos />} />
            {/* Enlace corto que se manda por WhatsApp: el código va en la ruta. */}
            <Route path="/leads-inactivos/:code" element={<LeadsInactivos />} />
            <Route path="/fonts" element={<FontGallery />} />
            <Route path="/" element={<MarketingLandingV2 />} />
            <Route path="/landingv2" element={<MarketingLanding />} />
            <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
            <Route path="/privacy" element={<Navigate to="/legal/privacy-policy" replace />} />
            <Route path="/legal/terms" element={<LegalDoc title="Términos y Condiciones" path="/legal/terms.md" />} />
            <Route path="/legal/privacy-policy" element={<LegalDoc title="Política de Privacidad" path="/legal/privacy-policy.md" />} />
            <Route path="/legal/data-deletion" element={<LegalDoc title="Eliminación y exportación de datos" path="/legal/data-deletion.md" />} />
            <Route path="/cookies" element={<LegalDoc title="Política de Cookies" path="/legal/cookies.es.md" />} />
            <Route path="/legal/cookies" element={<LegalDoc title="Política de Cookies" path="/legal/cookies.es.md" />} />
            <Route path="/legal/aup" element={<LegalDoc title="Política de Uso Aceptable" path="/legal/aup.es.md" />} />
            <Route path="/legal/dpa" element={<LegalDoc title="Acuerdo de Encargo del Tratamiento (DPA)" path="/legal/dpa.es.md" />} />
            <Route path="/aviso-legal" element={<LegalDoc title="Aviso Legal" path="/legal/aviso.es.md" />} />
            <Route path="/legal/deletion-status" element={<DeletionStatus />} />
            <Route
              path="/_internal/whatsapp-leads-animation"
              element={
                <ProtectedRoute>
                  <WhatsAppLeadsAnimation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/_internal/whatsapp-animation-lab"
              element={
                <ProtectedRoute>
                  <WhatsAppAnimationLab />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Onboarding />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/connect-whatsapp"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ConnectWhatsApp />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/anuncios"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Listings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/captaciones"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Captaciones />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Leads />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/seguimiento"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Seguimiento />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/seguimiento/tareas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SeguimientoTareas />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conversaciones"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Conversations />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notificaciones"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Notificaciones />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/cualificados" element={<CualificadosRedirect />} />
            <Route
              path="/alertas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Alerts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Configuracion />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/historial"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AuditLog />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suscripcion"
              element={
                <ProtectedRoute requiredRoles={["member", "admin", "owner", "super_admin"]}>
                  <Layout>
                    <Subscription />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requiredRoles={["admin", "owner", "super_admin"]}>
                  <Layout>
                    <Users />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/uso"
              element={
                <ProtectedRoute requiredRoles={["owner", "admin", "super_admin"]}>
                  <Layout>
                    <Usage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizacion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Organizacion />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/equipo" element={<Navigate to="/organizacion" replace />} />
            <Route
              path="/onboards"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <Layout>
                    <AdminOnboards />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tools"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <Layout>
                    <AdminTools />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/twilio-migration"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <Layout>
                    <AdminTwilioMigration />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/botTest"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BotTest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-templates"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EmailGallery />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundRedirect />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        </CollabProvider>
      </AuthProvider>
      </CookieConsentProvider>
    </QueryClientProvider>
  );
}

export default App;
