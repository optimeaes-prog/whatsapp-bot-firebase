import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Megaphone,
  Users,
  MessageSquare,

  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  History,
  PhoneIncoming,
  UserCog,
  Shield,
  ChevronDown,
  ChevronRight,
  Coins,
  Rocket,
  FileBox,
} from "lucide-react";
import { cn } from "../lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const mainNavItems: NavItem[] = [
  { href: "/onboarding", label: "Onboarding", icon: <Rocket size={20} /> },
  { href: "/dashboard", label: "Dashboard", icon: <Home size={20} /> },
  { href: "/anuncios", label: "Anuncios", icon: <Megaphone size={20} /> },
  { href: "/leads", label: "Leads", icon: <Users size={20} /> },
  { href: "/conversaciones", label: "Conversaciones", icon: <MessageSquare size={20} /> },

  { href: "/llamadas", label: "Llamadas", icon: <PhoneIncoming size={20} /> },
  { href: "/creditos", label: "Créditos", icon: <Coins size={20} /> },
];

const adminNavItems: NavItem[] = [
  { href: "/onboards", label: "Onboards", icon: <FileBox size={20} /> },
  { href: "/alertas", label: "Alertas", icon: <Bell size={20} /> },
  { href: "/historial", label: "Historial", icon: <History size={20} /> },
  { href: "/usuarios", label: "Usuarios", icon: <UserCog size={20} /> },
  { href: "/configuracion", label: "Configuración", icon: <Settings size={20} /> },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCurrentlyInAdminRoute = adminNavItems.some(item => location.pathname === item.href);
  const [adminExpanded, setAdminExpanded] = useState(isCurrentlyInAdminRoute);
  const isAdmin = user?.email === "ejperezreyes@gmail.com";
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);

  useEffect(() => {
    async function checkOnboarding() {
      if (!user) return;
      try {
        const { getOrganizationSettings } = await import("../services/organization");
        const settings = await getOrganizationSettings();
        setOnboardingCompleted((settings.onboardingStep || 1) >= 6);
      } catch (error) {
        console.error("Failed to load onboarding status", error);
      }
    }
    checkOnboarding();
  }, [user, location.pathname]); // refetch on navigation just in case

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          {mainNavItems.map((item) => {
            const isTarget = location.pathname === item.href;
            const isOnboardingItem = item.href === "/onboarding";

            if (isOnboardingItem && !onboardingCompleted) {
              return (
                <div key={item.href} className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">
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
                      <span className="font-bold">{item.label}</span>
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
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <button
                onClick={() => setAdminExpanded(!adminExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-btn transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield size={20} />
                  <span className="font-medium">Admin</span>
                </div>
                {adminExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
