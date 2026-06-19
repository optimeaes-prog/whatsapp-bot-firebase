import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FolderOpen, Search, Plus, Phone, Mail, MapPin, Megaphone, ImageOff } from "lucide-react";
import type { Prospect } from "../types";
import { PROSPECT_STAGE_LABELS } from "../types";
import { getCaptaciones, getCaptacionesForAgent } from "../services/captaciones";
import { getOrgMembers, type SystemUser } from "../services/users";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatPhoneWhatsApp } from "../lib/utils";
import { PROSPECT_SOURCE_LABELS, PROSPECT_STAGE_CLASSES } from "../lib/prospectMeta";
import { OPERATION_FILTER_LABEL, PROSPECT_OPERATION_FILTER_OPTIONS } from "../lib/operationFilter";
import { OperationTypeBadge } from "../components/StatusBadges";
import { PageHeader, PageLoading, FilterCard, FilterDropdown, Button } from "../components/ui";
import { ProspectDrawer } from "../components/ProspectDrawer";
import { ProspectCreateModal } from "../components/ProspectCreateModal";

type OpFilter = "all" | "Venta" | "Alquiler" | "Traspaso";
type AnuncioFilter = "all" | "with" | "without";

/**
 * Captaciones: la cartera "rica" de inmuebles + propietarios captados (fotos, datos del
 * inmueble y contacto del dueño). Es el mismo registro que Seguimiento (Prospect), visto
 * como repositorio en lugar de como tablero de etapas. Desde aquí se crea un Anuncio
 * autocompletando los datos (ver Listings).
 */
export function Captaciones() {
  const { user, organizationId, effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
  const isAgent = effectiveRole === "agent";
  const isManager = effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "super_admin";

  const [items, setItems] = useState<Prospect[]>([]);
  const [members, setMembers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [opFilter, setOpFilter] = useState<OpFilter>("all");
  const [anuncioFilter, setAnuncioFilter] = useState<AnuncioFilter>("all");

  const [selected, setSelected] = useState<Prospect | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    load();
    if (isManager) {
      getOrgMembers(organizationId)
        .then((m) => setMembers(m.filter((u) => u.role === "agent" || u.role === "admin" || u.role === "owner")))
        .catch((e) => console.error("[Captaciones] members failed", e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, effectiveRole, effectiveUid]);

  async function load() {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    setLoading(true);
    try {
      const data = isAgent ? await getCaptacionesForAgent(effectiveUid) : await getCaptaciones();
      setItems(data);
    } catch (e) {
      console.error("[Captaciones] load failed", e);
      toast.error("Error al cargar las captaciones");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return items.filter((p) => {
      const matchesSearch = !q ||
        p.ownerName?.toLowerCase().includes(q) ||
        p.phone?.includes(debouncedSearch) ||
        p.email?.toLowerCase().includes(q) ||
        p.municipality?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q);
      const matchesOp = opFilter === "all" || p.operationType === opFilter;
      const matchesAnuncio = anuncioFilter === "all" ||
        (anuncioFilter === "with" ? !!p.wonListingId : !p.wonListingId);
      return matchesSearch && matchesOp && matchesAnuncio;
    });
  }, [items, debouncedSearch, opFilter, anuncioFilter]);

  if (loading) return <PageLoading className="h-64" />;

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title="Captaciones"
          subtitle={`Inmuebles y propietarios captados · ${filtered.length} de ${items.length}`}
          actions={
            <Button onClick={() => setCreateOpen(true)} disabled={isImpersonationReadOnly}>
              <Plus size={16} /> Nueva captación
            </Button>
          }
        />
      </div>

      {/* Filtros */}
      <FilterCard className="mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por propietario, teléfono, email, municipio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              label={OPERATION_FILTER_LABEL}
              value={opFilter}
              onChange={(v) => setOpFilter(v as OpFilter)}
              options={PROSPECT_OPERATION_FILTER_OPTIONS}
            />
            <FilterDropdown
              label="Anuncio"
              value={anuncioFilter}
              onChange={(v) => setAnuncioFilter(v as AnuncioFilter)}
              options={[
                { value: "all", label: "Todas" },
                { value: "without", label: "Sin anuncio" },
                { value: "with", label: "Con anuncio" },
              ]}
            />
          </div>
        </div>
      </FilterCard>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">No hay captaciones</p>
          <p className="text-sm">Crea tu primera captación con el botón “Nueva captación”.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <CaptacionCard key={p.id} c={p} onOpen={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          readOnly={isImpersonationReadOnly}
          isManager={isManager}
          currentUid={effectiveUid}
          currentName={user?.displayName || user?.email || undefined}
          members={members}
          onClose={() => setSelected(null)}
          onChanged={load}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}

      {createOpen && (
        <ProspectCreateModal
          readOnly={isImpersonationReadOnly}
          isManager={isManager}
          currentUid={effectiveUid}
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={load}
          onOpenExisting={(p) => { setCreateOpen(false); setSelected(p); }}
        />
      )}
    </div>
  );
}

function CaptacionCard({ c, onOpen }: { c: Prospect; onOpen: (p: Prospect) => void }) {
  const cover = c.photos?.[0];
  const metrics = [c.price, c.m2 ? `${c.m2} m²` : "", c.rooms ? `${c.rooms} hab` : ""].filter(Boolean);
  const location = [c.municipality, c.zone].filter(Boolean).join(" · ");
  return (
    <div
      onClick={() => onOpen(c)}
      className="card !p-0 overflow-hidden cursor-pointer hover:border-primary-300 hover:shadow-md transition-all flex items-stretch"
    >
      <div className="w-32 sm:w-44 shrink-0 bg-gray-100 flex items-center justify-center relative">
        {cover ? (
          <img src={cover} alt={c.ownerName || "Captación"} className="w-full h-full object-cover" />
        ) : (
          <ImageOff className="text-gray-300" size={28} />
        )}
        {c.wonListingId && (
          <Link
            to="/anuncios"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 text-white text-[10px] font-bold px-2 py-1 shadow-sm hover:bg-emerald-700"
            title="Esta captación ya tiene anuncio"
          >
            <Megaphone size={11} /> Con anuncio
          </Link>
        )}
      </div>

      <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="min-w-0 sm:flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 text-sm truncate">{c.ownerName || "Sin nombre"}</p>
            <OperationTypeBadge type={c.operationType} />
          </div>

          <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
            <MapPin size={12} className="shrink-0" /> {location || "Sin ubicación"}
          </p>

          {metrics.length > 0 && (
            <p className="text-xs font-semibold text-gray-700 mt-1.5">{metrics.join(" · ")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1 text-xs text-gray-600 sm:w-52 sm:shrink-0">
          {c.phone && (
            <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 truncate">
              <Phone size={12} className="shrink-0" /> {formatPhoneWhatsApp(c.phone)}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-800 truncate">
              <Mail size={12} className="shrink-0" /> {c.email}
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1 sm:w-36 sm:shrink-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PROSPECT_STAGE_CLASSES[c.stage])}>
            {PROSPECT_STAGE_LABELS[c.stage]}
          </span>
          {c.source && (
            <span className="text-[11px] text-gray-400">{PROSPECT_SOURCE_LABELS[c.source]}</span>
          )}
        </div>
      </div>
    </div>
  );
}
