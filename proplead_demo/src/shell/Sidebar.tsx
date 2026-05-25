import { Rocket, Home, Megaphone, Users, MessageSquare, CreditCard, Building2, LogOut } from "lucide-react";
import { staticFile } from "remotion";

export type SidebarKey = "onboarding" | "dashboard" | "anuncios" | "leads" | "conversaciones" | "suscripcion" | "equipo";

const NAV: { key: SidebarKey; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: "onboarding", label: "Onboarding", Icon: Rocket },
  { key: "dashboard", label: "Dashboard", Icon: Home },
  { key: "anuncios", label: "Anuncios", Icon: Megaphone },
  { key: "leads", label: "Leads", Icon: Users },
  { key: "conversaciones", label: "Conversaciones", Icon: MessageSquare },
  { key: "suscripcion", label: "Suscripción", Icon: CreditCard },
  { key: "equipo", label: "Equipo", Icon: Users },
];

export function Sidebar({ active }: { active: SidebarKey }) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="border-b border-gray-200 px-3 py-8">
        <img src={staticFile("logo.png")} alt="Proplead" className="mx-auto my-2 h-auto w-44" />
      </div>

      {/* Org switcher */}
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary-700">
            <Building2 size={14} />
            Organización activa
          </div>
          <div className="flex items-center justify-between rounded-md border border-primary-200 bg-white px-3 py-2 text-sm text-gray-800">
            <span>Utopía Living</span>
            <span className="text-gray-400">▾</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4 pt-4">
        {NAV.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                isActive ? "bg-primary-50 text-primary-700" : "text-gray-600"
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </div>
          );
        })}

        <div className="pt-4 mt-4 border-t border-gray-100">
          <div className="flex items-center justify-between px-3 py-2 text-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-primary-500/80" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Panel de Control</span>
            </div>
            <span className="text-gray-400">▾</span>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
            <span className="text-sm font-medium text-primary-700">E</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">ejperezreyes@gmail.com</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="underline underline-offset-2">Términos</span>
          <span className="underline underline-offset-2">Privacidad</span>
          <span className="underline underline-offset-2">Cookies</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 text-gray-600">
          <LogOut size={20} />
          <span>Cerrar sesión</span>
        </div>
      </div>
    </aside>
  );
}
