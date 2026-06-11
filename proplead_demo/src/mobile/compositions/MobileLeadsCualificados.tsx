import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import type { ReactNode } from "react";
import { Euro, Calendar, PawPrint, CreditCard, Users, FileText, Check } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { MobileLeadsPage } from "../MobileLeadsPage";
import { TouchIndicator, type TapKeyframe } from "../TouchIndicator";
import { useScaledFrame } from "../../shell/useScaledFrame";
import { MOCK_LEADS, QUALIFIED_LEADS } from "../../data/mockLeads";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Mobile layout coords. 1080×1920 canvas.
// "Cualificados" tab is the 4th of 5 in the toggle row. Tabs are at y ≈ 295.
// Toggle starts at x=72 (header has px-8), spans to x=1008. Each tab ~187 wide.
// 4th tab center: 72 + 187*3.5 = 72 + 654 = 726
const TAB_CUALIFICADOS = { x: 726, y: 296 };
// "Ver" link on first qualified lead card (Carmen R.) — top of the list
// Cards start at y ≈ 480 after header+tabs+search. First "Ver" link at the
// right edge of Carmen's card around (980, 520).
const VER_RESUMEN_ROW1 = { x: 980, y: 520 };

const TAPS: TapKeyframe[] = [
  { frame: 155, x: TAB_CUALIFICADOS.x, y: TAB_CUALIFICADOS.y },
  { frame: 310, x: VER_RESUMEN_ROW1.x, y: VER_RESUMEN_ROW1.y },
];

const SUMMARY_FIELDS: { label: string; value: string; icon: ReactNode }[] = [
  { label: "Ingresos", value: "€4 200/mes", icon: <Euro size={28} className="text-gray-500" /> },
  { label: "Entrada deseada", value: "1 sept", icon: <Calendar size={28} className="text-gray-500" /> },
  { label: "Mascotas", value: "No", icon: <PawPrint size={28} className="text-gray-500" /> },
  { label: "Método de pago", value: "Transferencia", icon: <CreditCard size={28} className="text-gray-500" /> },
  { label: "Personas", value: "2 adultos", icon: <Users size={28} className="text-gray-500" /> },
  { label: "Honorarios", value: "1 mes", icon: <FileText size={28} className="text-gray-500" /> },
];

export function MobileLeadsCualificados() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  const tabClickAt = 155;
  const verResumenClickAt = 310;

  const pillSpring = spring({
    frame: frame - tabClickAt,
    fps,
    config: { damping: 18, stiffness: 110 },
    durationInFrames: 26,
  });
  const tabPillIndex = frame < tabClickAt ? 0 : 0 + (3 - 0) * pillSpring;
  const activeTab = frame < tabClickAt ? "Todos" : "Cualificados";

  const useQualifiedRows = frame >= tabClickAt + 12;
  const rows = useQualifiedRows ? QUALIFIED_LEADS : MOCK_LEADS;
  const totalLeads = MOCK_LEADS.length;
  const shownLeads = rows.length;

  // Drawer slides UP from the bottom on mobile (bottom sheet)
  const drawerProgress = spring({
    frame: frame - verResumenClickAt,
    fps,
    config: { damping: 22, stiffness: 130 },
    durationInFrames: 32,
  });
  const drawerVisible = frame >= verResumenClickAt;
  const fieldsBaseStart = verResumenClickAt + 35;
  const fieldStaggerFrames = 18;
  const pillBreathe = drawerVisible ? 0.5 + 0.5 * Math.sin((frame - verResumenClickAt) / 18) : 1;

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <MobileShell>
        <MobileLeadsPage
          activeTab={activeTab as "Todos" | "Cualificados"}
          tabPillIndex={tabPillIndex}
          totalLeads={totalLeads}
          shownLeads={shownLeads}
          selectedIds={new Set()}
          rowsToRender={rows}
          bulkBarVisible={false}
          bulkBarOffset={-100}
        />

        {/* Bottom sheet drawer with Carmen's summary */}
        {drawerVisible && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              transform: `translateY(${interpolate(drawerProgress, [0, 1], [100, 0])}%)`,
              background: "white",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              boxShadow: "0 -12px 32px rgba(0,0,0,0.15)",
              zIndex: 50,
              maxHeight: "82%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="h-1.5 w-20 rounded-full bg-gray-300" />
            </div>
            {/* Drawer header */}
            <div className="border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white px-8 pb-6 pt-4">
              <p className="text-base font-semibold uppercase tracking-wider text-primary-600">Resumen del lead</p>
              <h3 className="mt-2 text-5xl font-bold text-gray-900">Carmen R.</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 text-lg font-semibold text-emerald-700"
                  style={{ opacity: 0.7 + 0.3 * pillBreathe }}
                >
                  <Check size={20} strokeWidth={3} />
                  Cualificado
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-base font-medium text-gray-600">
                  Los Alamos · 111536482
                </span>
              </div>
            </div>

            {/* Fields */}
            <div className="flex-1 space-y-3 overflow-hidden px-8 py-6">
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
                    className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4"
                    style={{
                      opacity: progress,
                      transform: `translateX(${(1 - progress) * 30}px)`,
                    }}
                  >
                    <div className="flex items-center gap-3 text-gray-700">
                      {f.icon}
                      <span className="text-xl font-medium">{f.label}</span>
                    </div>
                    <span className="text-2xl font-semibold text-gray-900">{f.value}</span>
                  </div>
                );
              })}

              {/* Resumen IA */}
              <div
                className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/40 p-5"
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
                <p className="text-xl leading-relaxed text-gray-800">
                  Familia de 2 adultos sin mascotas. Ingresos €4 200/mes. Acepta 1 mes de honorarios y entrada a partir de septiembre.
                </p>
              </div>
            </div>
          </div>
        )}
      </MobileShell>

      <TouchIndicator taps={TAPS} frame={frame} />
    </AbsoluteFill>
  );
}
