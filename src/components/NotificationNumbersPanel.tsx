import { useCallback, useEffect, useState } from "react";
import { Phone, Plus, Star, Trash2, X, Loader2, Check, Clock3 } from "lucide-react";
import { Button } from "./ui/Button";
import { PhoneVerifyFlow } from "./PhoneVerifyFlow";
import {
  deleteNotificationNumber,
  listNotificationNumbers,
  setOrgDefaultNotificationNumber,
} from "../services/notificationNumbers";
import type { NotificationNumber } from "../types";
import { toast } from "sonner";

type Props = {
  /** Only managers can add / delete; non-managers see a read-only list. */
  canManage: boolean;
};

export function NotificationNumbersPanel({ canManage }: Props) {
  const [numbers, setNumbers] = useState<NotificationNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all = await listNotificationNumbers();
      setNumbers(all);
    } catch (e) {
      console.error("Error loading notification numbers", e);
      toast.error("No se pudieron cargar los números de notificación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(num: NotificationNumber) {
    if (!confirm(`¿Eliminar ${num.e164}? Dejará de recibir resúmenes.`)) return;
    try {
      setBusyId(num.id);
      await deleteNotificationNumber(num.id);
      toast.success("Número eliminado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMakeDefault(num: NotificationNumber) {
    try {
      setBusyId(num.id);
      await setOrgDefaultNotificationNumber(num.id);
      toast.success("Número predeterminado actualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  }

  const verified = numbers.filter((n) => n.verified);
  const pending = numbers.filter((n) => !n.verified);

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900 font-heading">Números de notificación</h3>
          <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {verified.length} verificado{verified.length === 1 ? "" : "s"}
          </span>
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} />
            Añadir número
          </Button>
        ) : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-10 flex items-center justify-center text-gray-400 text-sm gap-2">
            <Loader2 className="animate-spin" size={16} /> Cargando…
          </div>
        ) : numbers.length === 0 ? (
          <div className="py-10 text-center">
            <Phone className="mx-auto text-gray-300 mb-2" size={28} />
            <p className="text-sm text-gray-500">
              Aún no hay números verificados. Añade el primero para empezar a recibir resúmenes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...verified, ...pending].map((num) => (
              <li
                key={num.id}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 " +
                      (num.verified
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700")
                    }
                    aria-hidden
                  >
                    {num.verified ? <Check size={16} /> : <Clock3 size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-gray-900 font-semibold">
                        {num.e164}
                      </span>
                      {num.isOrgDefault ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100"
                          title="Número predeterminado de la organización"
                        >
                          <Star size={10} fill="currentColor" />
                          Predeterminado
                        </span>
                      ) : null}
                      {!num.verified ? (
                        <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                          Pendiente
                        </span>
                      ) : null}
                    </div>
                    {num.label ? (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{num.label}</p>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-1 sm:gap-2">
                    {num.verified && !num.isOrgDefault ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-gray-500 hover:text-primary-700 px-2 py-1 rounded-btn disabled:opacity-50"
                        onClick={() => void handleMakeDefault(num)}
                        disabled={busyId === num.id}
                      >
                        Hacer predeterminado
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-btn transition-all disabled:opacity-40"
                      title="Eliminar número"
                      onClick={() => void handleDelete(num)}
                      disabled={busyId === num.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Los números deben verificarse por SMS antes de poder asignarse a un anuncio. Cuando crees un
        anuncio, sólo aparecerán aquí los que estén verificados.
      </p>

      {addOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
          />
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="bg-primary-500 h-2 w-full" />
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-heading">
                    Verificar número
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Te enviaremos un código por SMS para confirmar el número.
                  </p>
                </div>
                <button
                  onClick={() => setAddOpen(false)}
                  className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-btn transition-all"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              <PhoneVerifyFlow
                allowLabel
                source="team_add"
                onVerified={async () => {
                  setAddOpen(false);
                  await load();
                }}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
