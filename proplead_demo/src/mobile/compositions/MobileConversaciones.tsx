import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { MobileShell } from "../MobileShell";
import { MobileConversacionesPage } from "../MobileConversacionesPage";
import { TouchIndicator, type TapKeyframe } from "../TouchIndicator";
import { useScaledFrame } from "../../shell/useScaledFrame";
import { CONV_CARMEN } from "../../data/mockConversations";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Mobile coords for Conversaciones list view (1080×1920).
// ANUNCIO chip is below the search bar, at approximately y=480.
const ANUNCIO_FILTER = { x: 540, y: 500 };
// Carmen R. row is the second card in the list (after Lina). y ≈ 700.
const CONV_ROW_CARMEN = { x: 540, y: 745 };

const TAPS: TapKeyframe[] = [
  { frame: 86, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y },
  { frame: 142, x: CONV_ROW_CARMEN.x, y: CONV_ROW_CARMEN.y },
];

// All-listings rows (visible before filter applied)
const ROWS_ALL = [
  { id: "r-lina", name: "Lina B.", phone: "+49 15* **** ****", listing: "Casa Algarrobo", date: "22 may 16:26", count: 5 },
  { id: "r-carmen", name: "Carmen R.", phone: "+34 664 *** ***", listing: "Los Alamos", date: "22 may 13:11", count: 7, finished: true },
  { id: "r-daniel", name: "Daniel F.", phone: "+34 685 *** ***", listing: "Adosado Chilches", date: "22 may 09:52", count: 5 },
  { id: "r-giuseppe", name: "Giuseppe T.", phone: "+41 7** *** ***", listing: "Casa Algarrobo", date: "22 may 09:18", count: 4 },
  { id: "r-eddy", name: "Eddy R.", phone: "+34 669 *** ***", listing: "Casa Algarrobo", date: "21 may 11:03", count: 15 },
  { id: "r-hans", name: "Hans M.", phone: "+31 6**** ***07", listing: "Casa Algarrobo", date: "21 may 06:17", count: 9, finished: true },
];

const ROWS_LOS_ALAMOS = [
  { id: "r-carmen", name: "Carmen R.", phone: "+34 664 *** ***", listing: "Los Alamos", date: "22 may 13:11", count: 7, finished: true },
  { id: "r-tomas", name: "Tomás L.", phone: "+34 671 *** ***", listing: "Los Alamos", date: "20 may 14:08", count: 6 },
  { id: "r-marta", name: "Marta P.", phone: "+34 622 *** ***", listing: "Los Alamos", date: "18 may 09:42", count: 4 },
];

export function MobileConversaciones() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  // Phases
  const filterClickedAt = 86;
  const listingPickedAt = 100; // mobile: no dropdown step shown, filter applies immediately after tap
  const convClickedAt = 142;
  const scrollStartAt = 200;
  const scrollEndAt = 290;
  const notesPanelStartAt = 305;
  const notesTypingStartAt = 330;
  const notesTypingEndAt = 575;
  const tagsStartAt = 582;

  const listingFilter = frame < listingPickedAt ? "Todos" : "Los Alamos";
  const filterHighlight = frame >= filterClickedAt - 4 && frame < listingPickedAt + 16;

  const rowsBase = frame < listingPickedAt ? ROWS_ALL : ROWS_LOS_ALAMOS;
  const visibleRows = rowsBase.map((r) => ({
    ...r,
    selected: r.id === "r-carmen" && frame >= convClickedAt - 6 && frame < convClickedAt + 8,
  }));

  // View switches to thread after Carmen tap
  const view: "list" | "thread" = frame >= convClickedAt ? "thread" : "list";

  const threadHeaderProgress = spring({
    frame: frame - convClickedAt,
    fps,
    config: { damping: 18, stiffness: 120 },
    durationInFrames: 24,
  });

  const messagesOpacity = spring({
    frame: frame - convClickedAt,
    fps,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 28,
  });

  // Scroll: start with bottom = -1400 (content pushed below, showing top), end at 0
  // Larger negative because mobile messages bubbles wrap more = taller content
  const scrollOffsetPx = interpolate(frame, [scrollStartAt, scrollEndAt], [-1400, 0], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const notesPanelProgress = spring({
    frame: frame - notesPanelStartAt,
    fps,
    config: { damping: 20, stiffness: 120 },
    durationInFrames: 24,
  });

  const notesFullText = CONV_CARMEN.notes;
  const typingProgress = interpolate(
    frame,
    [notesTypingStartAt, notesTypingEndAt],
    [0, 1],
    { easing: Easing.linear, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notesTypedText = notesFullText.slice(0, Math.floor(typingProgress * notesFullText.length));
  const notesGenerating = frame >= notesPanelStartAt && frame < notesTypingEndAt + 4;

  const tagsCount = CONV_CARMEN.tags.length;
  const visibleTagsCount = Math.max(
    0,
    Math.min(tagsCount, Math.floor((frame - tagsStartAt) / 6) + 1),
  );

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <MobileShell>
        <MobileConversacionesPage
          view={view}
          listingFilter={listingFilter}
          filterHighlight={filterHighlight}
          visibleRows={visibleRows}
          conv={view === "thread" ? CONV_CARMEN : undefined}
          threadHeaderProgress={threadHeaderProgress}
          messagesOpacity={messagesOpacity}
          scrollOffsetPx={scrollOffsetPx}
          notesPanelProgress={notesPanelProgress}
          notesTypedText={notesTypedText}
          notesGenerating={notesGenerating}
          visibleTagsCount={visibleTagsCount}
        />
      </MobileShell>

      {/* Taps only happen in list view */}
      {view === "list" && <TouchIndicator taps={TAPS} frame={frame} />}
    </AbsoluteFill>
  );
}
