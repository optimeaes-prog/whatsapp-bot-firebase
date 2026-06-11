import { AbsoluteFill, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { MobileShell } from "../MobileShell";
import { MobileLeadsPage } from "../MobileLeadsPage";
import { TouchIndicator, type TapKeyframe } from "../TouchIndicator";
import { useScaledFrame } from "../../shell/useScaledFrame";
import { MOCK_LEADS } from "../../data/mockLeads";
import { X, MessageCircle, CheckCircle2 } from "lucide-react";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Mobile coords. Lead cards stacked vertically in the list. After bulk bar
// appears, the 3 selected leads sit at top with checkboxes on the left.
// First card top ≈ y=480 (after header + tabs + search), each card ~165 tall + 12 gap.
// After bulk bar: cards shift down by ~150 more.
const CHECKBOX_ROW_0 = { x: 100, y: 670 };
const CHECKBOX_ROW_1 = { x: 100, y: 850 };
const CHECKBOX_ROW_2 = { x: 100, y: 1030 };
const ENVIAR_BTN = { x: 250, y: 575 };
const TEXTAREA_CLICK = { x: 540, y: 900 };
const SEND_BTN = { x: 740, y: 1620 };

const TAPS: TapKeyframe[] = [
  { frame: 60, x: CHECKBOX_ROW_0.x, y: CHECKBOX_ROW_0.y },
  { frame: 95, x: CHECKBOX_ROW_1.x, y: CHECKBOX_ROW_1.y },
  { frame: 130, x: CHECKBOX_ROW_2.x, y: CHECKBOX_ROW_2.y },
  { frame: 215, x: ENVIAR_BTN.x, y: ENVIAR_BTN.y },
  { frame: 260, x: TEXTAREA_CLICK.x, y: TEXTAREA_CLICK.y },
  { frame: 535, x: SEND_BTN.x, y: SEND_BTN.y },
];

const MESSAGE_TEXT = "Hola, te confirmo la visita para el viernes a las 18:00. ¿Te viene bien?";

export function MobileLeadsBulk() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  const selectedIds = new Set<string>();
  if (frame >= 60) selectedIds.add(MOCK_LEADS[0].id);
  if (frame >= 95) selectedIds.add(MOCK_LEADS[1].id);
  if (frame >= 130) selectedIds.add(MOCK_LEADS[2].id);

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

  // Modal
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
  const showCaret = frame >= typingStart && frame < typingEnd + 8 && Math.floor(frame / 6) % 2 === 0;

  // Send → success state lasts until end of video
  const sendClickAt = 535;
  const sentState = frame >= sendClickAt;
  const modalAlive = modalVisible;

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <MobileShell>
        <MobileLeadsPage
          activeTab="Todos"
          tabPillIndex={0}
          totalLeads={MOCK_LEADS.length}
          shownLeads={MOCK_LEADS.length}
          selectedIds={selectedIds}
          bulkBarVisible={bulkBarVisible}
          bulkBarOffset={bulkBarOffset}
          bulkBarHighlight={enviarHighlight ? "enviar" : null}
        />

        {/* Modal — bottom sheet for mobile */}
        {modalAlive && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                opacity: sentState ? 0.5 : modalProgress,
                zIndex: 40,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                transform: `translateY(${interpolate(modalProgress, [0, 1], [100, 0])}%)`,
                background: "white",
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                zIndex: 41,
                overflow: "hidden",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="h-1.5 w-20 rounded-full bg-gray-300" />
              </div>

              {!sentState ? (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-200 px-8 py-5">
                    <div className="flex items-center gap-3">
                      <MessageCircle size={32} className="text-primary-500" />
                      <h3 className="text-3xl font-bold text-gray-900">Enviar mensaje</h3>
                    </div>
                    <X size={32} className="text-gray-400" />
                  </div>

                  {/* Body */}
                  <div className="px-8 py-6">
                    <p className="mb-2 text-xl font-semibold text-gray-700">Enviando a 3 leads seleccionados</p>
                    <p className="mb-5 text-base text-gray-500">El mensaje se enviará como una plantilla aprobada de WhatsApp.</p>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                      <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Mensaje</p>
                      <p className="min-h-[160px] whitespace-pre-wrap text-xl leading-relaxed text-gray-900">
                        {typedText}
                        {showCaret && <span className="ml-0.5 inline-block h-6 w-0.5 align-middle bg-primary-500" />}
                      </p>
                    </div>

                    <div className="mt-3 text-right text-base text-gray-400">
                      {MESSAGE_TEXT.length - charCount === 0 ? "Listo para enviar" : `${charCount} / ${MESSAGE_TEXT.length}`}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-8 py-6">
                    <div
                      className={`rounded-2xl px-6 py-5 text-center text-xl font-semibold text-white transition-all ${
                        frame >= sendClickAt - 5 ? "bg-primary-600 ring-4 ring-primary-200" : "bg-primary-500"
                      }`}
                    >
                      Enviar a 3 leads
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-center text-lg font-medium text-gray-700">
                      Cancelar
                    </div>
                  </div>
                </>
              ) : (
                /* Sent success state */
                <div className="flex flex-col items-center justify-center px-10 pb-16 pt-10 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 size={56} className="text-emerald-600" />
                  </div>
                  <h3 className="mt-6 text-4xl font-bold text-gray-900">Mensaje enviado</h3>
                  <p className="mt-3 text-xl text-gray-500">3 conversaciones se reanudarán automáticamente.</p>
                </div>
              )}
            </div>
          </>
        )}
      </MobileShell>

      {/* No taps during success state — modal stands alone */}
      {!sentState && <TouchIndicator taps={TAPS} frame={frame} />}
    </AbsoluteFill>
  );
}
