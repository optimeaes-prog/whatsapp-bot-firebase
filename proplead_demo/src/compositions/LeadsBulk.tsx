import { AbsoluteFill, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LeadsPage } from "../pages/LeadsPage";
import { Cursor } from "../shell/Cursor";
import type { CursorKeyframe } from "../shell/useCursorKeyframes";
import { useScaledFrame } from "../shell/useScaledFrame";
import { MOCK_LEADS } from "../data/mockLeads";
import { X, MessageCircle, CheckCircle2 } from "lucide-react";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Coords re-measured pixel-precisely after Leads + modal text-size bumps.
// Row positions AFTER bulk-bar has been added to layout (the bar takes layout
// space immediately when the first checkbox is checked).
const CHECKBOX_ROW_0 = { x: 68, y: 538 };
const CHECKBOX_ROW_1 = { x: 68, y: 595 };
const CHECKBOX_ROW_2 = { x: 68, y: 652 };
const ENVIAR_BTN = { x: 1347, y: 403 };
// Inside the modal (wider now): typed text starts ~x=600 y=520. Click target slightly
// inset so the cursor lands clearly on the textarea body.
const TEXTAREA_CLICK = { x: 640, y: 540 };
// Park position during typing — bottom-right of modal body, below typed text.
const TEXTAREA_REST = { x: 1280, y: 690 };
const SEND_BTN = { x: 1219, y: 748 };

const CURSOR: CursorKeyframe[] = [
  { frame: 0, x: 1820, y: 40 },
  // Check 3 rows
  { frame: 50, x: CHECKBOX_ROW_0.x, y: CHECKBOX_ROW_0.y, action: "move" },
  { frame: 60, x: CHECKBOX_ROW_0.x, y: CHECKBOX_ROW_0.y, action: "click" },
  { frame: 88, x: CHECKBOX_ROW_1.x, y: CHECKBOX_ROW_1.y, action: "move" },
  { frame: 95, x: CHECKBOX_ROW_1.x, y: CHECKBOX_ROW_1.y, action: "click" },
  { frame: 120, x: CHECKBOX_ROW_2.x, y: CHECKBOX_ROW_2.y, action: "move" },
  { frame: 130, x: CHECKBOX_ROW_2.x, y: CHECKBOX_ROW_2.y, action: "click" },
  // Move to "Enviar mensaje" button
  { frame: 200, x: ENVIAR_BTN.x, y: ENVIAR_BTN.y, action: "move" },
  { frame: 215, x: ENVIAR_BTN.x, y: ENVIAR_BTN.y, action: "click" },
  // Move to textarea, click, then drift down-right out of the typed-text area so
  // the cursor doesn't cover the message while it's being typed.
  { frame: 250, x: TEXTAREA_CLICK.x, y: TEXTAREA_CLICK.y, action: "move" },
  { frame: 260, x: TEXTAREA_CLICK.x, y: TEXTAREA_CLICK.y, action: "click" },
  { frame: 285, x: TEXTAREA_REST.x, y: TEXTAREA_REST.y, action: "move" },
  // Linger out of the way while typing animates the message text in
  { frame: 500, x: TEXTAREA_REST.x, y: TEXTAREA_REST.y },
  // Move to send
  { frame: 520, x: SEND_BTN.x, y: SEND_BTN.y, action: "move" },
  { frame: 535, x: SEND_BTN.x, y: SEND_BTN.y, action: "click" },
  { frame: 600, x: SEND_BTN.x, y: SEND_BTN.y },
];

const MESSAGE_TEXT = "Hola, te confirmo la visita para el viernes a las 18:00. ¿Te viene bien?";

export function LeadsBulk() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  // Selection state
  const selectedIds = new Set<string>();
  if (frame >= 60) selectedIds.add(MOCK_LEADS[0].id);
  if (frame >= 95) selectedIds.add(MOCK_LEADS[1].id);
  if (frame >= 130) selectedIds.add(MOCK_LEADS[2].id);

  // Bulk bar visibility
  const bulkBarVisible = selectedIds.size > 0;
  const bulkBarSpring = spring({
    frame: frame - 60,
    fps,
    config: { damping: 18, stiffness: 130 },
    durationInFrames: 22,
  });
  const bulkBarOffset = interpolate(bulkBarSpring, [0, 1], [-100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enviarHighlight = frame >= 200 && frame < 240;

  // Modal state
  const modalOpenAt = 220;
  const modalVisible = frame >= modalOpenAt;
  const modalProgress = spring({
    frame: frame - modalOpenAt,
    fps,
    config: { damping: 22, stiffness: 150 },
    durationInFrames: 24,
  });

  // Typing
  const typingStart = 270;
  const typingEnd = 500;
  const charsPerFrame = MESSAGE_TEXT.length / (typingEnd - typingStart);
  const charCount = Math.min(
    MESSAGE_TEXT.length,
    Math.max(0, Math.floor((frame - typingStart) * charsPerFrame)),
  );
  const typedText = MESSAGE_TEXT.slice(0, charCount);
  const showCursor = frame >= typingStart && frame < typingEnd + 8 && Math.floor(frame / 6) % 2 === 0;

  // Sending state
  const sendClickAt = 535;
  const sentState = frame >= sendClickAt && frame < sendClickAt + 18;
  const modalDismissAt = sendClickAt + 18;
  const modalAlive = modalVisible && frame < modalDismissAt + 8;
  const modalCloseProgress = interpolate(frame, [modalDismissAt, modalDismissAt + 8], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Toast
  const toastAt = modalDismissAt;
  const toastProgress = spring({
    frame: frame - toastAt,
    fps,
    config: { damping: 18, stiffness: 130 },
    durationInFrames: 22,
  });
  const toastVisible = frame >= toastAt;

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <LeadsPage
        activeTab="Todos"
        tabPillIndex={0}
        totalLeads={MOCK_LEADS.length}
        shownLeads={MOCK_LEADS.length}
        selectedIds={selectedIds}
        bulkBarVisible={bulkBarVisible}
        bulkBarOffset={bulkBarOffset}
        bulkBarHighlight={enviarHighlight ? "enviar" : null}
      />

      {/* Modal */}
      {modalAlive && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              opacity: sentState ? 0.5 : modalProgress * modalCloseProgress,
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 760,
              transform: `translate(-50%, -50%) scale(${0.92 + modalProgress * 0.08})`,
              opacity: modalProgress * modalCloseProgress,
              background: "white",
              borderRadius: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
              zIndex: 41,
              overflow: "hidden",
            }}
          >
            {!sentState ? (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-7 py-5">
                  <div className="flex items-center gap-2.5 text-gray-900">
                    <MessageCircle size={24} className="text-primary-500" />
                    <h3 className="text-2xl font-bold">Enviar mensaje</h3>
                  </div>
                  <X size={24} className="text-gray-400" />
                </div>

                {/* Modal body */}
                <div className="p-7">
                  <p className="mb-1.5 text-lg font-semibold text-gray-700">Enviando a 3 leads seleccionados</p>
                  <p className="mb-4 text-base text-gray-500">El mensaje se enviará como una plantilla aprobada de WhatsApp.</p>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Mensaje</p>
                    <p className="min-h-[110px] whitespace-pre-wrap text-xl leading-relaxed text-gray-900">
                      {typedText}
                      {showCursor && <span className="ml-0.5 inline-block h-6 w-0.5 align-middle bg-primary-500" />}
                    </p>
                  </div>

                  <div className="mt-2.5 text-right text-base text-gray-400">
                    {MESSAGE_TEXT.length - charCount === 0 ? "Listo para enviar" : `${charCount} / ${MESSAGE_TEXT.length}`}
                  </div>
                </div>

                {/* Modal footer */}
                <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-7 py-5">
                  <div className="rounded-md border border-gray-200 bg-white px-5 py-2.5 text-lg font-medium text-gray-700">
                    Cancelar
                  </div>
                  <div
                    className={`rounded-md px-6 py-2.5 text-lg font-semibold text-white transition-all ${
                      frame >= sendClickAt - 5 ? "bg-primary-600 ring-4 ring-primary-200" : "bg-primary-500"
                    }`}
                  >
                    Enviar a 3 leads
                  </div>
                </div>
              </>
            ) : (
              // Sent success state
              <div className="flex flex-col items-center justify-center px-12 py-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 size={44} className="text-emerald-600" />
                </div>
                <h3 className="mt-5 text-3xl font-bold text-gray-900">Mensaje enviado</h3>
                <p className="mt-2.5 text-lg text-gray-500">3 conversaciones se reanudarán automáticamente.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toastVisible && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            right: 32,
            transform: `translateY(${interpolate(toastProgress, [0, 1], [40, 0])}px)`,
            opacity: toastProgress,
            zIndex: 60,
          }}
        >
          <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-white px-6 py-5 shadow-xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={26} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Mensaje enviado a 3 leads</p>
              <p className="text-base text-gray-500">Las respuestas aparecerán en Conversaciones.</p>
            </div>
          </div>
        </div>
      )}

      <Cursor keyframes={CURSOR} frame={frame} />
    </AbsoluteFill>
  );
}
