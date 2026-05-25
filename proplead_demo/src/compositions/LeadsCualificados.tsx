import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from "remotion";
import { useScaledFrame } from "../shell/useScaledFrame";
import { loadFont } from "@remotion/google-fonts/Inter";
import type { ReactNode } from "react";
import { Euro, Calendar, PawPrint, CreditCard, Users, FileText, Check } from "lucide-react";
import { LeadsPage } from "../pages/LeadsPage";
import { Cursor } from "../shell/Cursor";
import type { CursorKeyframe } from "../shell/useCursorKeyframes";
import { MOCK_LEADS, QUALIFIED_LEADS } from "../data/mockLeads";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Coords re-measured after Leads text-size bump.
const TAB_CUALIFICADOS = { x: 1601, y: 71 };
const VER_RESUMEN_ROW1 = { x: 1644, y: 447 };

// Storyboard spread across the 600-frame timeline:
//   0 ─ 90    : land on page, see all 12 leads with mixed statuses (reading beat)
//   90 ─ 140  : cursor sweeps to "Cualificados" tab
//   140 ─ 155 : click → table filters to 6 qualified leads
//   155 ─ 240 : reading beat (user sees filtered list)
//   240 ─ 310 : cursor moves down to Carmen's "Ver Resumen" link
//   310 ─ 320 : click → drawer starts sliding in
//   320 ─ 470 : drawer slides in + fields appear with stagger
//   470 ─ 560 : cursor drifts down through the drawer fields ("reading" them)
//   560 ─ 600 : final hold
const CURSOR: CursorKeyframe[] = [
  { frame: 0, x: 1750, y: 30 },
  { frame: 90, x: 1750, y: 30 },
  { frame: 140, x: TAB_CUALIFICADOS.x, y: TAB_CUALIFICADOS.y, action: "move" },
  { frame: 155, x: TAB_CUALIFICADOS.x, y: TAB_CUALIFICADOS.y, action: "click" },
  { frame: 280, x: VER_RESUMEN_ROW1.x, y: VER_RESUMEN_ROW1.y, action: "move" },
  { frame: 310, x: VER_RESUMEN_ROW1.x, y: VER_RESUMEN_ROW1.y, action: "click" },
  // After drawer is fully in, cursor drifts down through the fields, then settles
  { frame: 470, x: 1500, y: 380, action: "move" },
  { frame: 540, x: 1500, y: 640 },
  { frame: 600, x: 1500, y: 640 },
];

const SUMMARY_FIELDS: { label: string; value: string; icon: ReactNode }[] = [
  { label: "Ingresos", value: "€4 200/mes", icon: <Euro size={24} className="text-gray-500" /> },
  { label: "Entrada deseada", value: "1 sept", icon: <Calendar size={24} className="text-gray-500" /> },
  { label: "Mascotas", value: "No", icon: <PawPrint size={24} className="text-gray-500" /> },
  { label: "Método de pago", value: "Transferencia", icon: <CreditCard size={24} className="text-gray-500" /> },
  { label: "Personas", value: "2 adultos", icon: <Users size={24} className="text-gray-500" /> },
  { label: "Honorarios", value: "1 mes", icon: <FileText size={24} className="text-gray-500" /> },
];

export function LeadsCualificados() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  const tabClickAt = 155;
  const verResumenClickAt = 310;

  // Tab pill animation (0=Todos, 3=Cualificados)
  const pillSpring = spring({
    frame: frame - tabClickAt,
    fps,
    config: { damping: 18, stiffness: 110 },
    durationInFrames: 26,
  });
  const tabPillIndex = frame < tabClickAt ? 0 : 0 + (3 - 0) * pillSpring;

  // Active tab label switches as soon as click registers
  const activeTab = frame < tabClickAt ? "Todos" : "Cualificados";

  // Row set transitions visually — we render the full set first, then crossfade to qualified-only after pillSpring crosses 0.55
  const useQualifiedRows = frame >= tabClickAt + 12;
  const rows = useQualifiedRows ? QUALIFIED_LEADS : MOCK_LEADS;
  const totalLeads = MOCK_LEADS.length;
  const shownLeads = rows.length;

  // Drawer slide-in
  const drawerProgress = spring({
    frame: frame - verResumenClickAt,
    fps,
    config: { damping: 22, stiffness: 130 },
    durationInFrames: 32,
  });
  const drawerVisible = frame >= verResumenClickAt;

  // Drawer fields stagger — slower so each field is readable
  const fieldsBaseStart = verResumenClickAt + 35;
  const fieldStaggerFrames = 18;

  // Pill breathing
  const pillBreathe = drawerVisible
    ? 0.5 + 0.5 * Math.sin((frame - verResumenClickAt) / 18)
    : 1;

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <LeadsPage
        activeTab={activeTab as "Todos" | "Cualificados"}
        tabPillIndex={tabPillIndex}
        totalLeads={totalLeads}
        shownLeads={shownLeads}
        selectedIds={new Set()}
        rowsToRender={rows}
        bulkBarVisible={false}
        bulkBarOffset={-100}
      />

      {/* Drawer overlay */}
      {drawerVisible && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 680,
            transform: `translateX(${interpolate(drawerProgress, [0, 1], [100, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}%)`,
            background: "white",
            borderLeft: "1px solid #e5e7eb",
            boxShadow: "-12px 0 32px rgba(0,0,0,0.08)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drawer header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white px-7 py-6">
            <p className="text-base font-semibold uppercase tracking-wider text-primary-600">Resumen del lead</p>
            <h3 className="mt-1.5 text-4xl font-bold text-gray-900">Carmen R.</h3>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-lg font-semibold text-emerald-700"
                style={{ opacity: 0.7 + 0.3 * pillBreathe }}
              >
                <Check size={18} strokeWidth={3} />
                Cualificado
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-base font-medium text-gray-600">
                Los Alamos · 111536482
              </span>
            </div>
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-4 overflow-hidden p-7">
            {SUMMARY_FIELDS.map((f, idx) => {
              const start = fieldsBaseStart + idx * fieldStaggerFrames;
              const since = frame - start;
              const progress = interpolate(since, [0, 18], [0, 1], {
                easing: Easing.out(Easing.cubic),
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={f.label}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-5 py-4"
                  style={{
                    opacity: progress,
                    transform: `translateX(${(1 - progress) * 24}px)`,
                  }}
                >
                  <div className="flex items-center gap-3 text-gray-700">
                    {f.icon}
                    <span className="text-lg font-medium">{f.label}</span>
                  </div>
                  <span className="text-xl font-semibold text-gray-900">{f.value}</span>
                </div>
              );
            })}

            {/* Resumen IA */}
            <div
              className="mt-5 rounded-xl border border-primary-100 bg-primary-50/40 p-5"
              style={{
                opacity: interpolate(
                  frame - (fieldsBaseStart + SUMMARY_FIELDS.length * fieldStaggerFrames),
                  [0, 22],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                ),
              }}
            >
              <p className="mb-2 text-base font-semibold uppercase tracking-wider text-primary-700">Resumen IA</p>
              <p className="text-lg text-gray-800 leading-relaxed">
                Familia de 2 adultos sin mascotas. Ingresos €4 200/mes. Acepta 1 mes de honorarios y entrada a partir
                de septiembre. Lead listo para coordinar visita.
              </p>
            </div>
          </div>
        </div>
      )}

      <Cursor keyframes={CURSOR} frame={frame} />
    </AbsoluteFill>
  );
}
