import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCookieConsent } from "../contexts/CookieConsentContext";
import {
  Home,
  Megaphone,
  FolderOpen,
  Users,
  MessageSquare,
  PhoneCall,

  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Mail,
  History,
  UserCog,
  Shield,
  ChevronDown,
  Rocket,
  FileBox,
  CreditCard,
  Wrench,
  Building2,
  Eye,
  BarChart3,
} from "lucide-react";
import { cn } from "../lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** If set, the link is only rendered for users whose effectiveRole is in this list. */
  roles?: string[];
};

const mainNavItems: NavItem[] = [
  { href: "/onboarding", label: "Onboarding", icon: <Rocket size={20} /> },
  { href: "/dashboard", label: "Dashboard", icon: <Home size={20} /> },
  { href: "/anuncios", label: "Anuncios", icon: <Megaphone size={20} /> },
  { href: "/captaciones", label: "Captaciones", icon: <FolderOpen size={20} /> },
  { href: "/leads", label: "Leads", icon: <Users size={20} /> },
  { href: "/seguimiento", label: "Seguimiento", icon: <PhoneCall size={20} /> },
  { href: "/conversaciones", label: "Conversaciones", icon: <MessageSquare size={20} /> },

  { href: "/suscripcion", label: "Suscripción", icon: <CreditCard size={20} /> },
  { href: "/uso", label: "Uso", icon: <BarChart3 size={20} />, roles: ["owner", "admin", "super_admin"] },
  { href: "/organizacion", label: "Organización", icon: <Building2 size={20} /> },
];

const adminNavItems: NavItem[] = [
  { href: "/onboards", label: "Onboards", icon: <FileBox size={20} /> },
  { href: "/admin/tools", label: "Herramientas", icon: <Wrench size={20} /> },
  { href: "/botTest", label: "Bot Test", icon: <Wrench size={20} /> },
  { href: "/alertas", label: "Alertas", icon: <Bell size={20} /> },
  { href: "/email-templates", label: "Templates de Email", icon: <Mail size={20} /> },
  { href: "/historial", label: "Historial", icon: <History size={20} /> },
  { href: "/usuarios", label: "Usuarios", icon: <UserCog size={20} /> },
  { href: "/configuracion", label: "Configuración", icon: <Settings size={20} /> },
];

export function Layout({ children }: { children: ReactNode }) {
  const {
    user,
    signOut,
    role,
    effectiveRole,
    organizationId,
    availableOrganizations,
    switchOrganization,
    impersonation,
    clearImpersonation,
  } = useAuth();
  const { openPreferences: openCookiePreferences } = useCookieConsent();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCurrentlyInAdminRoute = adminNavItems.some(item => location.pathname === item.href);
  const [adminExpanded, setAdminExpanded] = useState(isCurrentlyInAdminRoute);
  const isAdmin = role === "super_admin";
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);

  useEffect(() => {
    async function checkOnboarding() {
      if (!user || !organizationId) return;
      try {
        const { getOrganizationSettings } = await import("../services/organization");
        const settings = await getOrganizationSettings();
        setOnboardingCompleted((settings.onboardingStep || 1) >= 7);
      } catch (error) {
        console.error("Failed to load onboarding status", error);
      }
    }
    checkOnboarding();
  }, [user, organizationId, location.pathname]); // refetch on navigation just in case

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {impersonation && (
        <div className="sticky top-0 z-[70] border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 font-heading">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="font-semibold text-amber-950">Modo solo lectura: vista como otro usuario</p>
                <p className="text-xs text-amber-900/80">
                  {[impersonation.displayName, impersonation.email].filter(Boolean).join(" · ") ||
                    impersonation.uid}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => clearImpersonation()}
              className="shrink-0 rounded-btn bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Salir de vista como…
            </button>
          </div>
        </div>
      )}
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-btn hover:bg-gray-100"
        >
          <Menu size={24} />
        </button>
        <img src="/logo.png" alt="Proplead" className="h-8 w-auto my-2" />
        <div className="w-10" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:transform-none flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="relative px-3 py-8 border-b border-gray-200">
          <img src="/logo.png" alt="Proplead" className="w-44 h-auto mx-auto my-4" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-3 p-2 rounded-btn hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto flex-1 pb-4">
          {isAdmin && (
            <div className="mb-4 p-3 rounded-xl border border-primary-100 bg-primary-50/60">
              <div className="flex items-center gap-2 mb-2 text-[11px] font-black text-primary-700 uppercase tracking-[0.16em] font-heading">
                <Building2 size={14} />
                Organización activa
              </div>
              <div className="relative">
                <select
                  value={organizationId}
                  onChange={(e) => switchOrganization(e.target.value)}
                  className="w-full appearance-none rounded-btn border border-primary-200 bg-white pl-3 pr-9 py-2 text-sm text-gray-800 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                >
                  {availableOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.agencyName || org.id}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-primary-500"
                />
              </div>
            </div>
          )}

          {mainNavItems.map((item) => {
            const isTarget = location.pathname === item.href;
            const isOnboardingItem = item.href === "/onboarding";
            const isSubscriptionItem = item.href === "/suscripcion";

            if (effectiveRole === "agent" && isSubscriptionItem) {
              return null;
            }

            if (item.roles && !item.roles.includes(effectiveRole)) {
              return null;
            }

            if (isOnboardingItem && !onboardingCompleted) {
              return (
                <div key={item.href} className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1 font-heading">
                    Acción requerida
                  </div>
                  <Link
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-3 rounded-btn transition-all border shadow-sm relative overflow-hidden",
                      isTarget
                        ? "bg-primary-600 text-white border-primary-700"
                        : "bg-primary-50 border-primary-200 text-primary-800 hover:bg-primary-100"
                    )}
                  >
                    {!isTarget && (
                      <div className="absolute top-0 right-0 w-2 h-full bg-primary-500 animate-pulse"></div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={isTarget ? "text-white" : "text-primary-600"}>{item.icon}</div>
                      <span className="font-bold font-heading">{item.label}</span>
                    </div>
                    {!isTarget && (
                       <span className="flex h-3 w-3 relative right-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                       </span>
                    )}
                  </Link>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-btn transition-colors",
                  isTarget
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {item.icon}
                <span className="font-medium font-heading">{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-btn transition-colors"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-primary-600" />
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] font-heading">Panel de Control</span>
                  </div>
                  <ChevronDown size={14} className={cn("text-gray-400 transition-transform", adminExpanded && "rotate-180")} />
                </div>
              </button>
              
              {adminExpanded && (
                <div className="mt-1 ml-3 space-y-1 border-l-2 border-gray-100 pl-2">
                  {adminNavItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-btn transition-colors",
                        location.pathname === item.href
                          ? "bg-primary-50 text-primary-700"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 font-medium text-sm">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
            <Link to="/legal/terms" className="hover:text-gray-700 underline underline-offset-2">
              Términos
            </Link>
            <Link to="/legal/privacy-policy" className="hover:text-gray-700 underline underline-offset-2">
              Privacidad
            </Link>
            <Link to="/cookies" className="hover:text-gray-700 underline underline-offset-2">
              Cookies
            </Link>
            <button
              type="button"
              onClick={openCookiePreferences}
              className="hover:text-gray-700 underline underline-offset-2"
            >
              Gestionar cookies
            </button>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-btn transition-colors"
          >
            <LogOut size={20} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
