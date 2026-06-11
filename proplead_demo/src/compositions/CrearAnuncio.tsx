import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CheckSquare, Square, ChevronDown, MapPin } from "lucide-react";
import { createContext, useContext } from "react";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// 14s timeline. Identificador + Operación are pre-filled at frame 0; the video
// animates ID Idealista → ID Fotocasa → Precio → m² → Habitaciones, then
// condiciones → filtros → paste descripción, with a 1s hold on the final state.
const STEP_STARTS = [0, 90, 240, 320] as const;
export const STEP_DURATIONS = [90, 150, 80, 100] as const;
export const CREAR_ANUNCIO_TOTAL_FRAMES = 420;

// Frame offset context — lets standalone per-step compositions render as if
// they were at the equivalent global frame in the combined timeline.
const FrameOffsetContext = createContext(0);

function useGlobalFrame() {
  const offset = useContext(FrameOffsetContext);
  return useCurrentFrame() + offset;
}

// Mock form values
const FORM = {
  identificador: "Piso 2 hab. Fuengirola",
  operationType: "Alquiler",
  idIdealista: "110595991",
  idFotocasa: "187654321",
  precio: "1.100",
  m2: "75",
  rooms: "2",
  condiciones: [
    "Sin mascotas",
    "Contrato mínimo 12 meses",
    "Nómina o contrato indefinido",
  ],
  ingresos: "2.500",
  maxPersonas: "3",
  descripcion:
    "Piso a estrenar en el centro de Fuengirola. 2 dormitorios, 1 baño completo y terraza con vistas parciales al mar. Cocina equipada, salón luminoso y plaza de garaje incluida. A 5 min de la playa y transporte. Disponible 1 junio. Fianza 2 meses.",
};

// Scroll positions (px) per step. Modal content is ~3400px tall.
// Two sets — one per supported canvas aspect ratio — so the active section
// sits nicely in the visible viewport for both 3:4 (1080×1440) and 9:16
// (1080×1920) canvases.
const STEP_SCROLL_Y_3_4 = [0, 1180, 1660, 1915] as const;
const STEP_SCROLL_Y_9_16 = [0, 760, 1280, 1480] as const;
const SCROLL_RAMP_FRAMES = 28;

function useStepScrollY(): readonly [number, number, number, number] {
  const { height } = useVideoConfig();
  return height >= 1800 ? STEP_SCROLL_Y_9_16 : STEP_SCROLL_Y_3_4;
}

// === Hooks ===

function useTypedText(target: string, startFrame: number, endFrame: number) {
  const frame = useGlobalFrame();
  if (frame < startFrame) return "";
  if (frame >= endFrame) return target;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  const chars = Math.floor(progress * target.length);
  return target.slice(0, chars);
}

function useFadeIn(startFrame: number, durationFrames = 12) {
  const frame = useGlobalFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function useCaretBlink() {
  const frame = useGlobalFrame();
  return Math.floor(frame / 14) % 2 === 0;
}

// === Main composition ===
export type CrearAnuncioStep = 1 | 2 | 3 | 4;

export function CrearAnuncio({ step }: { step?: CrearAnuncioStep } = {}) {
  // Provide frame offset so child hooks return the equivalent global frame.
  const offset = step ? STEP_STARTS[step - 1] : 0;
  return (
    <FrameOffsetContext.Provider value={offset}>
      <CrearAnuncioInner />
    </FrameOffsetContext.Provider>
  );
}

function CrearAnuncioInner() {
  const frame = useGlobalFrame();

  // Active step derived from frame — same logic for combined + standalone.
  let activeStep = 0;
  for (let i = 0; i < 4; i += 1) {
    if (frame >= STEP_STARTS[i]) activeStep = i;
  }

  // Fade in only at the very start of the timeline (global frame 0).
  const fadeIn = useFadeIn(0, 18);
  const scrollSet = useStepScrollY();
  const scrollY = computeScroll(frame, scrollSet);

  return (
    <AbsoluteFill style={{ fontFamily, background: "#FAFAFA", overflow: "hidden" }}>
      {/* Modal as full-bleed scrolling document */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: fadeIn,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${-scrollY}px)`,
            background: "white",
          }}
        >
          <ModalHeader />
          <div style={{ background: "#FAFAFA", padding: "44px 44px 48px 44px" }}>
            <SectionInfo active={activeStep === 0} />
            <div style={{ height: 44 }} />
            <SectionUbicacion />
            <div style={{ height: 44 }} />
            <SectionCondiciones active={activeStep === 1} />
            <div style={{ height: 44 }} />
            <SectionFiltros active={activeStep === 2} />
            <div style={{ height: 44 }} />
            <SectionDescripcion active={activeStep === 3} />
            <div style={{ height: 44 }} />
            <ModalFooter highlight={activeStep === 3 && frame > 388} />
          </div>
        </div>
      </div>

      <PasteIndicator />
    </AbsoluteFill>
  );
}

function computeScroll(frame: number, scrollSet: readonly [number, number, number, number]) {
  // Find active step from frame.
  let activeStep = 0;
  for (let i = 0; i < 4; i += 1) {
    if (frame >= STEP_STARTS[i]) activeStep = i;
  }
  if (activeStep === 0) return scrollSet[0];

  // Ramp scrollY from the PREVIOUS step's value to this step's value over the
  // first SCROLL_RAMP_FRAMES of the step. This keeps the boundary continuous.
  const boundary = STEP_STARTS[activeStep];
  if (frame < boundary + SCROLL_RAMP_FRAMES) {
    return interpolate(
      frame,
      [boundary, boundary + SCROLL_RAMP_FRAMES],
      [scrollSet[activeStep - 1], scrollSet[activeStep]],
      { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }
  return scrollSet[activeStep];
}

// === Pieces ===

function ModalHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "32px 44px",
        borderBottom: "1px solid #E5E7EB",
        background: "white",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 44, fontWeight: 600, color: "#111827" }}>Nuevo Anuncio</h2>
    </div>
  );
}

function ModalFooter({ highlight }: { highlight: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 14,
        paddingTop: 24,
        borderTop: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          padding: "18px 32px",
          borderRadius: 12,
          fontSize: 24,
          fontWeight: 500,
          color: "#374151",
          background: "white",
          border: "1px solid #D1D5DB",
        }}
      >
        Cancelar
      </div>
      <div
        style={{
          padding: "18px 36px",
          borderRadius: 12,
          fontSize: 24,
          fontWeight: 600,
          color: "white",
          background: "#E8992C",
          boxShadow: highlight
            ? "0 0 0 6px rgba(255, 176, 63, 0.35), 0 8px 20px rgba(232, 153, 44, 0.35)"
            : "0 4px 10px rgba(232, 153, 44, 0.25)",
          transition: "box-shadow 200ms",
        }}
      >
        Guardar
      </div>
    </div>
  );
}

// --- Section 1: Información del inmueble ---
// Identificador + Operación are pre-filled at frame 0. The video animates ID
// Idealista → ID Fotocasa → Precio → m² → Habitaciones during phase 1 (0-90).
function SectionInfo({ active }: { active: boolean }) {
  const frame = useGlobalFrame();

  const idIdeal = useTypedText(FORM.idIdealista, 5, 22);
  const idFoto = useTypedText(FORM.idFotocasa, 28, 45);
  const precio = useTypedText(FORM.precio, 50, 68);
  const m2 = useTypedText(FORM.m2, 72, 82);
  const rooms = useTypedText(FORM.rooms, 84, 88);

  const caret = useCaretBlink();

  return (
    <SectionCard active={active} title="Información del inmueble">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 22 }}>
        <Field
          label="Identificador"
          required
          value={FORM.identificador}
          placeholder="Ej: Piso 2 habitaciones en Fuengirola"
          counter={`${FORM.identificador.length}/50`}
        />
        <DropdownField
          label="Tipo de Operación"
          required
          value={FORM.operationType}
          selected="Alquiler"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 22 }}>
        <Field
          label="ID Idealista"
          required
          value={idIdeal}
          placeholder="Ej: 110595991"
          focused={frame >= 0 && frame < 26}
          showCaret={frame >= 0 && frame < 22 && caret}
        />
        <Field
          label="ID Fotocasa"
          required
          value={idFoto}
          placeholder="Ej: 123456789"
          focused={frame >= 26 && frame < 48}
          showCaret={frame >= 26 && frame < 45 && caret}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 22 }}>
        <Field
          label="ID Interno (CRM)"
          value=""
          placeholder="Mismo que ID si no tienen CRM"
        />
        <DropdownField
          label="Agente asignado"
          required
          value="Selecciona un agente..."
          placeholderColor
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22, marginTop: 22 }}>
        <Field
          label="Precio"
          required
          value={precio ? `${precio}${frame >= 70 ? " €/mes" : ""}` : ""}
          placeholder="Ej: 1100"
          focused={frame >= 48 && frame < 72}
          showCaret={frame >= 48 && frame < 68 && caret}
        />
        <Field
          label="Metros (m²)"
          required
          value={m2}
          placeholder="Ej: 75"
          focused={frame >= 70 && frame < 84}
          showCaret={frame >= 70 && frame < 82 && caret}
        />
        <Field
          label="Habitaciones"
          required
          value={rooms}
          placeholder="Ej: 2"
          focused={frame >= 82 && frame < 90}
          showCaret={frame >= 82 && frame < 88 && caret}
        />
      </div>
    </SectionCard>
  );
}

// --- Section: Ubicación (always inactive — shown for realism) ---
function SectionUbicacion() {
  return (
    <SectionCard active={false} title="Ubicación">
      <label style={{ display: "block", fontSize: 23, fontWeight: 500, color: "#374151", marginBottom: 14 }}>
        Dirección exacta <span style={{ color: "#EF4444" }}>*</span>
      </label>
      <div
        style={{
          padding: "20px 22px 20px 62px",
          border: "1px solid #D1D5DB",
          borderRadius: 12,
          background: "white",
          fontSize: 26,
          color: "#9CA3AF",
          position: "relative",
        }}
      >
        <MapPin size={26} color="#9CA3AF" style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)" }} />
        Calle, número, ciudad…
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 19, color: "#6B7280" }}>
        Busca y elige una sugerencia para rellenar calle, ciudad, provincia y CP; puedes editarlos abajo.
      </p>
      <div
        style={{
          marginTop: 22,
          padding: "18px 22px",
          background: "#F9FAFB",
          border: "1px solid #F3F4F6",
          borderRadius: 12,
          fontSize: 19,
          color: "#6B7280",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: "#9CA3AF" }}>▸</span>
        Detalles de dirección (opcional)
        <span style={{ marginLeft: 10, color: "#9CA3AF", fontWeight: 400 }}>Calle, ciudad, provincia, CP…</span>
      </div>
    </SectionCard>
  );
}

// --- Section: Condiciones a aceptar (phase 2: frames 90-240) ---
function SectionCondiciones({ active }: { active: boolean }) {
  const frame = useGlobalFrame();
  // Typing window spans most of phase 2 after the 30-frame scroll ramp.
  const typed = useBulletList(FORM.condiciones, 125, 230);
  const focused = frame >= 120 && frame < 240;
  const caret = useCaretBlink();

  const placeholder = "• Sin mascotas\n• Contrato mínimo 12 meses\n• Nómina o contrato indefinido";

  return (
    <SectionCard active={active} title="Cualificación y filtros">
      {/* Cualificación rápida toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 26,
          padding: "22px 24px",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          background: "white",
          marginBottom: 28,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 23, fontWeight: 500, color: "#111827" }}>Cualificación rápida</div>
          <p style={{ margin: "8px 0 0", fontSize: 19, lineHeight: 1.45, color: "#6B7280" }}>
            Si está activado, cuando entre un interesado por este anuncio se notificará al agente y el asistente hará handoff sin cualificar.
          </p>
        </div>
        <div
          style={{
            flexShrink: 0,
            width: 64,
            height: 36,
            borderRadius: 18,
            background: "#D1D5DB",
            position: "relative",
            marginTop: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            }}
          />
        </div>
      </div>

      {/* Condiciones a aceptar */}
      <label style={{ display: "block", fontSize: 23, fontWeight: 500, color: "#374151", marginBottom: 14 }}>
        Condiciones a aceptar
      </label>
      <div
        style={{
          minHeight: 280,
          padding: "22px 24px",
          border: focused ? "2px solid #FFB03F" : "1px solid #D1D5DB",
          borderRadius: 14,
          background: "white",
          boxShadow: focused ? "0 0 0 4px rgba(255, 176, 63, 0.15)" : "none",
          fontSize: 27,
          lineHeight: 1.7,
          color: typed ? "#111827" : "#9CA3AF",
          whiteSpace: "pre-wrap",
        }}
      >
        {typed || placeholder}
        {focused && caret && frame < 230 && (
          <span style={{ display: "inline-block", width: 2, height: 30, background: "#111827", marginLeft: 2, verticalAlign: "middle" }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: "#6B7280", marginTop: 14 }}>
        <span>Una por línea.</span>
        <span style={{ color: "#9CA3AF" }}>{(typed || "").length}/450</span>
      </div>
    </SectionCard>
  );
}

function useBulletList(items: readonly string[], startFrame: number, endFrame: number) {
  const frame = useGlobalFrame();
  if (frame < startFrame) return "";

  const fullText = items.map((it) => `• ${it}`).join("\n");
  if (frame >= endFrame) return fullText;

  const totalChars = fullText.length;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return fullText.slice(0, Math.floor(progress * totalChars));
}

// --- Section 3: Filtros de cualificación (phase 3: frames 240-320) ---
function SectionFiltros({ active }: { active: boolean }) {
  const frame = useGlobalFrame();
  const ingresos = useTypedText(FORM.ingresos, 275, 290);
  const maxPersonas = useTypedText(FORM.maxPersonas, 300, 312);
  const caret = useCaretBlink();

  return (
    <SectionCard
      active={active}
      title="Filtros de cualificación"
      sub="Opcionales — el asistente decidirá automáticamente si el lead cumple."
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Field
          label="Ingresos netos mensuales mínimos (€)"
          value={ingresos}
          placeholder="Ej: 2000"
          focused={frame >= 270 && frame < 296}
          showCaret={frame >= 270 && frame < 290 && caret}
        />
        <Field
          label="Máximo de personas en la vivienda"
          value={maxPersonas}
          placeholder="Ej: 3"
          focused={frame >= 298 && frame < 320}
          showCaret={frame >= 298 && frame < 312 && caret}
        />
      </div>
    </SectionCard>
  );
}

// --- Section 4: Descripción (phase 4: frames 320-420) ---
function SectionDescripcion({ active }: { active: boolean }) {
  const frame = useGlobalFrame();
  const pasted = frame >= 380;
  const focused = frame >= 355;
  const caret = useCaretBlink();

  return (
    <SectionCard
      active={active}
      title="Contenido comercial"
      sub="Descripción de anuncio en Idealista"
    >
      <p style={{ margin: "0 0 18px", fontSize: 21, color: "#6B7280" }}>
        Pega tu texto del portal para que la IA responda dudas con contexto real.
      </p>
      <div
        style={{
          minHeight: 360,
          padding: "24px 26px",
          border: focused ? "2px solid #FFB03F" : "1px solid #D1D5DB",
          borderRadius: 14,
          background: "white",
          boxShadow: focused ? "0 0 0 4px rgba(255, 176, 63, 0.15)" : "none",
          fontSize: 27,
          lineHeight: 1.65,
          color: pasted ? "#111827" : "#9CA3AF",
          position: "relative",
        }}
      >
        {pasted ? FORM.descripcion : "Pega aquí la descripción completa del anuncio de Idealista..."}
        {focused && !pasted && caret && (
          <span style={{ display: "inline-block", width: 2, height: 30, background: "#111827", marginLeft: 2, verticalAlign: "middle" }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 19, color: "#9CA3AF", marginTop: 14 }}>
        <span />
        <span>{pasted ? `${FORM.descripcion.length}/5000` : "0/5000"}</span>
      </div>
    </SectionCard>
  );
}

// --- Reusable card / fields ---

function SectionCard({
  active,
  title,
  sub,
  children,
}: {
  active: boolean;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        border: "1px solid #E5E7EB",
        background: "white",
        padding: "32px 36px 36px 36px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        opacity: active ? 1 : 0.42,
        filter: active ? "none" : "saturate(0.92)",
        transition: "opacity 200ms",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#6B7280",
          }}
        >
          {title}
        </div>
        {sub && (
          <div style={{ fontSize: 25, color: "#374151", marginTop: 8 }}>{sub}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  value,
  placeholder,
  focused,
  showCaret,
  counter,
}: {
  label: string;
  required?: boolean;
  value: string;
  placeholder: string;
  focused?: boolean;
  showCaret?: boolean;
  counter?: string;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 23, fontWeight: 500, color: "#374151", marginBottom: 14 }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <div
        style={{
          padding: "20px 22px",
          border: focused ? "2px solid #FFB03F" : "1px solid #D1D5DB",
          borderRadius: 12,
          background: "white",
          boxShadow: focused ? "0 0 0 4px rgba(255, 176, 63, 0.15)" : "none",
          fontSize: 26,
          color: value ? "#111827" : "#9CA3AF",
          minHeight: 34,
          display: "flex",
          alignItems: "center",
        }}
      >
        {showCaret && !value && (
          <span style={{ display: "inline-block", width: 2, height: 30, background: "#111827", marginRight: 2 }} />
        )}
        <span style={{ whiteSpace: "pre" }}>{value || placeholder}</span>
        {showCaret && value && (
          <span style={{ display: "inline-block", width: 2, height: 30, background: "#111827", marginLeft: 2 }} />
        )}
      </div>
      {counter && (
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 16, color: "#9CA3AF", marginTop: 6 }}>
          {counter}
        </div>
      )}
    </div>
  );
}

function DropdownField({
  label,
  required,
  value,
  placeholderColor,
  open,
  focused,
  hoveredOption,
  selected,
}: {
  label: string;
  required?: boolean;
  value: string;
  placeholderColor?: boolean;
  open?: boolean;
  focused?: boolean;
  hoveredOption?: "Venta" | "Alquiler";
  selected?: "Venta" | "Alquiler";
}) {
  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 23, fontWeight: 500, color: "#374151", marginBottom: 14 }}>
        {label}{required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <div
        style={{
          padding: "20px 22px",
          border: focused ? "2px solid #FFB03F" : "1px solid #D1D5DB",
          borderRadius: 12,
          background: "white",
          boxShadow: focused ? "0 0 0 4px rgba(255, 176, 63, 0.15)" : "none",
          fontSize: 26,
          color: placeholderColor ? "#9CA3AF" : "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{value}</span>
        <ChevronDown size={28} color="#9CA3AF" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 10,
            background: "white",
            borderRadius: 14,
            border: "1px solid #E5E7EB",
            boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
            padding: 10,
            zIndex: 5,
          }}
        >
          {(["Venta", "Alquiler"] as const).map((type) => {
            const isHovered = hoveredOption === type;
            const isSelected = selected === type;
            return (
              <div
                key={type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "18px 18px",
                  borderRadius: 10,
                  background: isHovered ? "#FFF7E6" : "white",
                }}
              >
                {isSelected ? (
                  <CheckSquare size={28} color="#E8992C" />
                ) : (
                  <Square size={28} color="#D1D5DB" />
                )}
                <span style={{ fontSize: 26, color: "#374151", fontWeight: 500 }}>{type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Paste indicator: ⌘V glyph for step 4 ---
function PasteIndicator() {
  const frame = useGlobalFrame();
  if (frame < 362 || frame > 392) return null;
  const t = (frame - 362) / 30; // 0..1
  const opacity =
    t < 0.6
      ? interpolate(t, [0, 0.2], [0, 1], { extrapolateRight: "clamp" })
      : interpolate(t, [0.6, 1], [1, 0], { extrapolateRight: "clamp" });
  const lift = interpolate(t, [0, 1], [0, -30]);

  return (
    <div
      style={{
        position: "absolute",
        left: 580,
        top: 920 + lift,
        opacity,
        pointerEvents: "none",
        zIndex: 9000,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "#111827",
          color: "white",
          borderRadius: 10,
          fontSize: 18,
          fontWeight: 600,
          boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
        }}
      >
        <kbd style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 6, padding: "2px 8px", fontSize: 16 }}>⌘</kbd>
        <kbd style={{ background: "#1F2937", border: "1px solid #374151", borderRadius: 6, padding: "2px 8px", fontSize: 16 }}>V</kbd>
        <span>Pegar</span>
      </div>
    </div>
  );
}
