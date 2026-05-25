import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { ConversacionesPage } from "../pages/ConversacionesPage";
import { Cursor } from "../shell/Cursor";
import type { CursorKeyframe } from "../shell/useCursorKeyframes";
import { useScaledFrame } from "../shell/useScaledFrame";
import { CONV_CARMEN } from "../data/mockConversations";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Layout constants (1920x1080) — list pane: 0..800, thread pane: 800..1920
// Coords measured pixel-precisely after panel was compacted vertically.
const ANUNCIO_FILTER = { x: 587, y: 306 };
const LISTING_OPTION_LOS_ALAMOS = { x: 610, y: 402 };
const CONV_ROW_CARMEN = { x: 220, y: 495 };
const THREAD_READING = { x: 1360, y: 500 };
// Parked at the bottom-right of the Tags card body (empty area below the tag pills)
// so the cursor doesn't sit on top of the AI-generated notes text.
const NOTES_AREA = { x: 1450, y: 1030 };

const CURSOR: CursorKeyframe[] = [
  { frame: 0, x: 1700, y: 140 },
  { frame: 28, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y, action: "move" },
  { frame: 44, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y, action: "click" },
  { frame: 72, x: LISTING_OPTION_LOS_ALAMOS.x, y: LISTING_OPTION_LOS_ALAMOS.y, action: "move" },
  { frame: 86, x: LISTING_OPTION_LOS_ALAMOS.x, y: LISTING_OPTION_LOS_ALAMOS.y, action: "click" },
  { frame: 130, x: CONV_ROW_CARMEN.x, y: CONV_ROW_CARMEN.y, action: "move" },
  { frame: 142, x: CONV_ROW_CARMEN.x, y: CONV_ROW_CARMEN.y, action: "click" },
  // Move cursor into the thread area while user reads + scrolls
  { frame: 200, x: THREAD_READING.x, y: THREAD_READING.y, action: "move" },
  { frame: 290, x: THREAD_READING.x, y: THREAD_READING.y },
  // Move cursor to the notes/tags panel as the AI summary generates
  { frame: 330, x: NOTES_AREA.x, y: NOTES_AREA.y, action: "move" },
  { frame: 600, x: NOTES_AREA.x, y: NOTES_AREA.y },
];

// All-listings rows (visible before filter applied)
const ROWS_ALL = [
  { id: "r-lina", name: "Lina B.", phone: "+49 15* **** ****", listing: "Casa Algarrobo", date: "22 may 2026, 16:26", count: 5 },
  { id: "r-carmen", name: "Carmen R.", phone: "+34 664 *** ***", listing: "Los Alamos", date: "22 may 2026, 13:11", count: 7, finished: true },
  { id: "r-daniel", name: "Daniel F.", phone: "+34 685 *** ***", listing: "Adosado Chilches", date: "22 may 2026, 09:52", count: 5 },
  { id: "r-giuseppe", name: "Giuseppe T.", phone: "+41 7** *** ***", listing: "Casa Algarrobo", date: "22 may 2026, 09:18", count: 4 },
  { id: "r-eddy", name: "Eddy R.", phone: "+34 669 *** ***", listing: "Casa Algarrobo", date: "21 may 2026, 11:03", count: 15 },
  { id: "r-hans", name: "Hans M.", phone: "+31 6**** ***07", listing: "Casa Algarrobo", date: "21 may 2026, 06:17", count: 9, finished: true },
  { id: "r-sergio", name: "Sergio P.", phone: "+34 695 *** ***", listing: "Sayalonga", date: "20 may 2026, 09:50", count: 11 },
  { id: "r-isa", name: "Isa G.", phone: "+34 639 *** ***", listing: "Benajarafe Paraíso del Sol", date: "19 may 2026, 18:23", count: 2 },
];

const ROWS_LOS_ALAMOS = [
  { id: "r-carmen", name: "Carmen R.", phone: "+34 664 *** ***", listing: "Los Alamos", date: "22 may 2026, 13:11", count: 7, finished: true, selected: false },
  { id: "r-tomas", name: "Tomás L.", phone: "+34 671 *** ***", listing: "Los Alamos", date: "20 may 2026, 14:08", count: 6 },
  { id: "r-marta", name: "Marta P.", phone: "+34 622 *** ***", listing: "Los Alamos", date: "18 may 2026, 09:42", count: 4 },
];

export function Conversaciones() {
  const frame = useScaledFrame();
  const { fps } = useVideoConfig();

  // Phases — restructured to give the AI-notes typing animation enough real time
  // to be readable. Scroll ends earlier and notes panel appears sooner so the
  // typing window spans almost 3s of real time.
  const filterClickedAt = 44;
  const listingPickedAt = 86;
  const convClickedAt = 142;
  const messagesShowAt = convClickedAt;
  const scrollStartAt = 200;
  const scrollEndAt = 290;
  const notesPanelStartAt = 305;
  const notesTypingStartAt = 330;
  const notesTypingEndAt = 575;
  const tagsStartAt = 582;

  const dropdownOpen = frame >= filterClickedAt && frame < listingPickedAt + 6;
  const listingFilter = frame < listingPickedAt ? "Todos" : "Los Alamos";

  // Filter highlight pulses around click moment
  const filterHighlight = frame >= filterClickedAt - 4 && frame < listingPickedAt + 12;

  // Rows visible: full list before pick, filtered after
  const rowsBase = frame < listingPickedAt ? ROWS_ALL : ROWS_LOS_ALAMOS;
  const visibleRows = rowsBase.map((r) => ({
    ...r,
    selected: r.id === "r-carmen" && frame >= convClickedAt,
  }));

  // Thread shows after Carmen clicked
  const showThread = frame >= convClickedAt;
  const threadHeaderProgress = spring({
    frame: frame - convClickedAt,
    fps,
    config: { damping: 18, stiffness: 120 },
    durationInFrames: 24,
  });

  // Messages — entire stack fades in once, then scrolls down via translateY
  const messagesOpacity = spring({
    frame: frame - messagesShowAt,
    fps,
    config: { damping: 18, stiffness: 100 },
    durationInFrames: 28,
  });

  // Scroll: starts with bottom = -700 (content pushed below container, first message at top of viewport)
  // ends with bottom = 0 (last message flush at container bottom — no gap above notas panel).
  // Initial value tuned for the larger text sizes that make total content height ~1500px in a ~760px container.
  const scrollOffsetPx = interpolate(frame, [scrollStartAt, scrollEndAt], [-1000, 0], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Notes panel slide-up + AI generation animation
  const notesPanelProgress = spring({
    frame: frame - notesPanelStartAt,
    fps,
    config: { damping: 20, stiffness: 120 },
    durationInFrames: 24,
  });

  // Notes typing: 1 char every ~0.6 frames (so ~120 chars in 72 frames)
  const notesFullText = CONV_CARMEN.notes;
  const typingProgress = interpolate(
    frame,
    [notesTypingStartAt, notesTypingEndAt],
    [0, 1],
    { easing: Easing.linear, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notesTypedText = notesFullText.slice(0, Math.floor(typingProgress * notesFullText.length));
  const notesGenerating = frame >= notesPanelStartAt && frame < notesTypingEndAt + 4;

  // Tags appear with stagger after notes done — only ~18 logical frames between
  // tagsStartAt and end of video, so use a tighter stagger.
  const tagsCount = CONV_CARMEN.tags.length;
  const visibleTagsCount = Math.max(
    0,
    Math.min(tagsCount, Math.floor((frame - tagsStartAt) / 6) + 1),
  );

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <ConversacionesPage
        listingFilter={listingFilter}
        listingDropdownOpen={dropdownOpen}
        listingHoverIdx={dropdownOpen && frame >= 70 ? 1 : undefined}
        filterHighlight={filterHighlight}
        visibleRows={visibleRows}
        showThread={showThread}
        conv={showThread ? CONV_CARMEN : undefined}
        threadHeaderProgress={threadHeaderProgress}
        messagesOpacity={messagesOpacity}
        scrollOffsetPx={scrollOffsetPx}
        notesPanelProgress={notesPanelProgress}
        notesTypedText={notesTypedText}
        notesGenerating={notesGenerating}
        visibleTagsCount={visibleTagsCount}
      />
      <Cursor keyframes={CURSOR} frame={frame} />
    </AbsoluteFill>
  );
}
