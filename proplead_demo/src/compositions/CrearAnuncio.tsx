import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { CheckSquare, Square, ChevronDown, XCircle, Megaphone, MapPin } from "lucide-react";
import { Cursor } from "../shell/Cursor";
import type { CursorKeyframe } from "../shell/useCursorKeyframes";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Step boundaries match the landing's STORY_FEATURES_STEP_ONE durations
// (14000ms / 11000ms / 8500ms / 8234ms) at 30fps.
const STEP_STARTS = [0, 420, 750, 1005] as const;
export const CREAR_ANUNCIO_TOTAL_FRAMES = 1252;

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

// Scroll positions (px) per step. Modal content is ~3400px tall, canvas is 1440.
// Each step shifts the content up to bring its section into focus.
const STEP_SCROLL_Y = [0, 1180, 1660, 1915] as const;
const SCROLL_RAMP_FRAMES = 28;

// === Cursor keyframes (viewport / canvas coordinates) ===
// Coordinates are AFTER the current step's scroll offset has been applied.
const CURSOR: CursorKeyframe[] = [
  // Step 1 — fill basic info (scrollY = 0)
  { frame: 0, x: 200, y: 1300 },
  { frame: 20, x: 270, y: 350, action: "move" },
  { frame: 32, x: 270, y: 350, action: "click" }, // Identificador
  { frame: 110, x: 830, y: 350, action: "move" },
  { frame: 122, x: 830, y: 350, action: "click" }, // Operation type dropdown
  { frame: 160, x: 830, y: 510, action: "move" },
  { frame: 172, x: 830, y: 510, action: "click" }, // Pick "Alquiler"
  { frame: 200, x: 270, y: 535, action: "move" },
  { frame: 212, x: 270, y: 535, action: "click" }, // ID Idealista
  { frame: 250, x: 760, y: 535, action: "move" },
  { frame: 262, x: 760, y: 535, action: "click" }, // ID Fotocasa
  { frame: 300, x: 230, y: 840, action: "move" },
  { frame: 312, x: 230, y: 840, action: "click" }, // Precio
  { frame: 340, x: 540, y: 840, action: "move" },
  { frame: 352, x: 540, y: 840, action: "click" }, // m²
  { frame: 380, x: 850, y: 840, action: "move" },
  { frame: 392, x: 850, y: 840, action: "click" }, // Habitaciones

  // Step 2 — condiciones textarea (scrollY = 1180)
  { frame: 432, x: 540, y: 620, action: "move" },
  { frame: 444, x: 540, y: 620, action: "click" },
  { frame: 740, x: 540, y: 620 },

  // Step 3 — filtros (scrollY = 1660)
  { frame: 770, x: 280, y: 680, action: "move" }, // Ingresos
  { frame: 782, x: 280, y: 680, action: "click" },
  { frame: 870, x: 780, y: 680, action: "move" }, // Max personas
  { frame: 882, x: 780, y: 680, action: "click" },
  { frame: 1000, x: 780, y: 680 },

  // Step 4 — descripción textarea (scrollY = 1915, clamped at max scroll)
  { frame: 1020, x: 540, y: 940, action: "move" },
  { frame: 1032, x: 540, y: 940, action: "click" },
  { frame: 1252, x: 540, y: 940 },
];

// === Hooks ===

function useTypedText(target: string, startFrame: number, endFrame: number) {
  const frame = useCurrentFrame();
  if (frame < startFrame) return "";
  if (frame >= endFrame) return target;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  const chars = Math.floor(progress * target.length);
  return target.slice(0, chars);
}

function useFadeIn(startFrame: number, durationFrames = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function useCaretBlink() {
  const frame = useCurrentFrame();
  return Math.floor(frame / 14) % 2 === 0;
}

// === Main composition ===
export function CrearAnuncio() {
  const frame = useCurrentFrame();

  // Active step
  let activeStep = 0;
  for (let i = 0; i < 4; i += 1) {
    if (frame >= STEP_STARTS[i]) activeStep = i;
  }

  const fadeIn = useFadeIn(0, 18);
  const scrollY = computeScroll(frame);

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
            <ModalFooter highlight={activeStep === 3 && frame > 1180} />
          </div>
        </div>
      </div>

      <PasteIndicator />
      <Cursor keyframes={CURSOR} />
    </AbsoluteFill>
  );
}

function computeScroll(frame: number) {
  for (let i = 0; i < 3; i += 1) {
    const boundary = STEP_STARTS[i + 1];
    if (frame < boundary - SCROLL_RAMP_FRAMES) return STEP_SCROLL_Y[i];
    if (frame < boundary) {
      return interpolate(
        frame,
        [boundary - SCROLL_RAMP_FRAMES, boundary],
        [STEP_SCROLL_Y[i], STEP_SCROLL_Y[i + 1]],
        { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
    }
  }
  return STEP_SCROLL_Y[3];
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
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: 16,
            background: "#FFF7E6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#E8992C",
          }}
        >
          <Megaphone size={34} />
        </div>
        <h2 style={{ margin: 0, fontSize: 44, fontWeight: 600, color: "#111827" }}>Nuevo Anuncio</h2>
      </div>
      <XCircle size={44} color="#9CA3AF" />
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
function SectionInfo({ active }: { active: boolean }) {
  const frame = useCurrentFrame();

  // Typing windows for each field (frames are global)
  const identificador = useTypedText(FORM.identificador, 40, 100);
  const idIdeal = useTypedText(FORM.idIdealista, 220, 245);
  const idFoto = useTypedText(FORM.idFotocasa, 270, 295);
  const precio = useTypedText(FORM.precio, 320, 340);
  const m2 = useTypedText(FORM.m2, 360, 378);
  const rooms = useTypedText(FORM.rooms, 400, 410);

  const operationSelected = frame >= 172;
  const operationDropdownOpen = frame >= 122 && frame < 180;
  const operationHovered = frame >= 160 && frame < 178;

  const caret = useCaretBlink();

  return (
    <SectionCard active={active} title="Información del inmueble">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 22 }}>
        <Field
          label="Identificador"
          required
          value={identificador}
          placeholder="Ej: Piso 2 habitaciones en Fuengirola"
          focused={frame >= 32 && frame < 120}
          showCaret={frame >= 32 && frame < 110 && caret}
          counter={`${identificador.length}/50`}
        />
        <DropdownField
          label="Tipo de Operación"
          required
          value={operationSelected ? FORM.operationType : "Selecciona..."}
          placeholderColor={!operationSelected}
          open={operationDropdownOpen}
          focused={frame >= 122 && frame < 200}
          hoveredOption={operationHovered ? "Alquiler" : undefined}
          selected={operationSelected ? "Alquiler" : undefined}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 22 }}>
        <Field
          label="ID Idealista"
          required
          value={idIdeal}
          placeholder="Ej: 110595991"
          focused={frame >= 212 && frame < 270}
          showCaret={frame >= 212 && frame < 248 && caret}
        />
        <Field
          label="ID Fotocasa"
          required
          value={idFoto}
          placeholder="Ej: 123456789"
          focused={frame >= 262 && frame < 320}
          showCaret={frame >= 262 && frame < 298 && caret}
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
          value={precio ? `${precio}${frame >= 345 ? " €/mes" : ""}` : ""}
          placeholder="Ej: 1100"
          focused={frame >= 312 && frame < 360}
          showCaret={frame >= 312 && frame < 343 && caret}
        />
        <Field
          label="Metros (m²)"
          required
          value={m2}
          placeholder="Ej: 75"
          focused={frame >= 352 && frame < 400}
          showCaret={frame >= 352 && frame < 380 && caret}
        />
        <Field
          label="Habitaciones"
          required
          value={rooms}
          placeholder="Ej: 2"
          focused={frame >= 392 && frame < 420}
          showCaret={frame >= 392 && frame < 412 && caret}
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

// --- Section: Condiciones a aceptar ---
function SectionCondiciones({ active }: { active: boolean }) {
  const frame = useCurrentFrame();
  // Typing windows for each bullet inside Step 2 (start ~450, end ~720)
  const typed = useBulletList(FORM.condiciones, 450, 710);
  const focused = frame >= 442 && frame < 760;
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
        {focused && caret && frame < 720 && (
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
  const frame = useCurrentFrame();
  if (frame < startFrame) return "";

  const fullText = items.map((it) => `• ${it}`).join("\n");
  if (frame >= endFrame) return fullText;

  const totalChars = fullText.length;
  const progress = (frame - startFrame) / (endFrame - startFrame);
  return fullText.slice(0, Math.floor(progress * totalChars));
}

// --- Section 3: Filtros de cualificación ---
function SectionFiltros({ active }: { active: boolean }) {
  const frame = useCurrentFrame();
  const ingresos = useTypedText(FORM.ingresos, 790, 830);
  const maxPersonas = useTypedText(FORM.maxPersonas, 890, 905);
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
          focused={frame >= 782 && frame < 870}
          showCaret={frame >= 782 && frame < 833 && caret}
        />
        <Field
          label="Máximo de personas en la vivienda"
          value={maxPersonas}
          placeholder="Ej: 3"
          focused={frame >= 882 && frame < 1000}
          showCaret={frame >= 882 && frame < 908 && caret}
        />
      </div>
    </SectionCard>
  );
}

// --- Section 4: Descripción ---
function SectionDescripcion({ active }: { active: boolean }) {
  const frame = useCurrentFrame();
  const pasted = frame >= 1058;
  const focused = frame >= 1032;
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
  const frame = useCurrentFrame();
  if (frame < 1040 || frame > 1075) return null;
  const t = (frame - 1040) / 35; // 0..1
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
