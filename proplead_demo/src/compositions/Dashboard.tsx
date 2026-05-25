import { AbsoluteFill, Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { DashboardPage } from "../pages/DashboardPage";
import { Counter } from "../ui/Counter";
import { Cursor } from "../shell/Cursor";
import type { CursorKeyframe } from "../shell/useCursorKeyframes";
import { useScaledFrame } from "../shell/useScaledFrame";
import { METRICS_30D, METRICS_7D, METRICS_CASA_ALGARROBO } from "../data/mockMetrics";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Coords re-measured pixel-precisely after dashboard text-size bump.
const FECHA_FILTER = { x: 1463, y: 68 };
const FECHA_OPTION_7D = { x: 1472, y: 192 };
const ANUNCIO_FILTER = { x: 1750, y: 68 };
const ANUNCIO_OPTION_CASA = { x: 1719, y: 244 };

// Storyboard spread evenly across the logical 600-frame timeline so that
// activity isn't crammed at the start with a long static hold at the end.
//
//   0 ─ 100    : land on dashboard, brief beat to see 30-day data
//   100 ─ 150  : cursor sweeps to FECHA filter
//   150 ─ 160  : click FECHA → dropdown opens
//   160 ─ 210  : cursor moves to "Últimos 7 días", click
//   210 ─ 320  : metric counters tween + reading beat (7-day values)
//   320 ─ 380  : cursor sweeps to ANUNCIO filter, click
//   380 ─ 430  : cursor moves to "Casa Algarrobo", click
//   430 ─ 560  : metric counters tween again + funnel resize
//   560 ─ 600  : cursor parks while final state holds
const CURSOR: CursorKeyframe[] = [
  { frame: 0, x: 960, y: 40 },
  { frame: 100, x: 960, y: 40 },
  { frame: 150, x: FECHA_FILTER.x, y: FECHA_FILTER.y, action: "move" },
  { frame: 160, x: FECHA_FILTER.x, y: FECHA_FILTER.y, action: "click" },
  { frame: 195, x: FECHA_OPTION_7D.x, y: FECHA_OPTION_7D.y, action: "move" },
  { frame: 210, x: FECHA_OPTION_7D.x, y: FECHA_OPTION_7D.y, action: "click" },
  { frame: 360, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y, action: "move" },
  { frame: 375, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y, action: "click" },
  { frame: 415, x: ANUNCIO_OPTION_CASA.x, y: ANUNCIO_OPTION_CASA.y, action: "move" },
  { frame: 430, x: ANUNCIO_OPTION_CASA.x, y: ANUNCIO_OPTION_CASA.y, action: "click" },
  { frame: 560, x: 1700, y: 200 },
  { frame: 600, x: 1700, y: 200 },
];

export function Dashboard() {
  const frame = useScaledFrame();

  // Phase boundaries
  const fechaClickAt = 160;
  const fechaPickAt = 210;
  const anuncioClickAt = 375;
  const anuncioPickAt = 430;

  // Dropdown UI states
  const dateDropdownOpen = frame >= fechaClickAt && frame < fechaPickAt + 6;
  const listingDropdownOpen = frame >= anuncioClickAt && frame < anuncioPickAt + 6;
  const dateHover = dateDropdownOpen && frame >= 195 ? 1 : undefined; // "Últimos 7 días"
  const listingHover = listingDropdownOpen && frame >= 415 ? 2 : undefined; // "Casa Algarrobo"

  // Active filter labels
  const dateLabel = frame < fechaPickAt ? "Últimos 30 días" : "Últimos 7 días";
  const listingLabel = frame < anuncioPickAt ? "Todos" : "Casa Algarrobo";

  // Filter highlight pulses on/around clicks
  const dateHighlight = frame >= fechaClickAt - 4 && frame < fechaPickAt + 14;
  const listingHighlight = frame >= anuncioClickAt - 4 && frame < anuncioPickAt + 14;

  // Recent leads list
  const recentLeads: "all30d" | "all7d" | "casaAlgarrobo" =
    frame < fechaPickAt ? "all30d" : frame < anuncioPickAt ? "all7d" : "casaAlgarrobo";

  // Funnel widths (animated)
  const funnelWidths = computeFunnelWidths(frame, fechaPickAt, anuncioPickAt);

  // KPI counters
  // First transition: 30d → 7d at frame fechaPickAt over 60f
  // Second transition: 7d → casa at frame anuncioPickAt over 60f
  const qualRate = (
    <DoubleCounter
      v1={METRICS_30D.qualificationRate}
      v2={METRICS_7D.qualificationRate}
      v3={METRICS_CASA_ALGARROBO.qualificationRate}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const responseRate = (
    <DoubleCounter
      v1={METRICS_30D.responseRate}
      v2={METRICS_7D.responseRate}
      v3={METRICS_CASA_ALGARROBO.responseRate}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const leads = (
    <DoubleCounter
      v1={METRICS_30D.leads}
      v2={METRICS_7D.leads}
      v3={METRICS_CASA_ALGARROBO.leads}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const messages = (
    <DoubleCounter
      v1={METRICS_30D.messages}
      v2={METRICS_7D.messages}
      v3={METRICS_CASA_ALGARROBO.messages}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const fConv = (
    <DoubleCounter
      v1={METRICS_30D.funnel.conversations}
      v2={METRICS_7D.funnel.conversations}
      v3={METRICS_CASA_ALGARROBO.funnel.conversations}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const fResp = (
    <DoubleCounter
      v1={METRICS_30D.funnel.responded}
      v2={METRICS_7D.funnel.responded}
      v3={METRICS_CASA_ALGARROBO.funnel.responded}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );
  const fQual = (
    <DoubleCounter
      v1={METRICS_30D.funnel.qualified}
      v2={METRICS_7D.funnel.qualified}
      v3={METRICS_CASA_ALGARROBO.funnel.qualified}
      t1={fechaPickAt}
      t2={anuncioPickAt}
    />
  );

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <DashboardPage
        dateLabel={dateLabel}
        listingLabel={listingLabel}
        qualRate={qualRate}
        responseRate={responseRate}
        leads={leads}
        messages={messages}
        funnel={{ conversations: fConv, responded: fResp, qualified: fQual }}
        funnelWidths={funnelWidths}
        recentLeads={recentLeads}
        dateDropdownOpen={dateDropdownOpen}
        listingDropdownOpen={listingDropdownOpen}
        dateHover={dateHover}
        listingHover={listingHover}
        dateHighlight={dateHighlight}
        listingHighlight={listingHighlight}
      />
      <Cursor keyframes={CURSOR} frame={frame} />
    </AbsoluteFill>
  );
}

function DoubleCounter({
  v1,
  v2,
  v3,
  t1,
  t2,
  duration = 90,
}: {
  v1: number;
  v2: number;
  v3: number;
  t1: number;
  t2: number;
  duration?: number;
}) {
  // Pick which segment we're in
  // segment A: before t1 → v1
  // segment B: t1..t1+duration → v1→v2
  // segment C: t1+duration..t2 → v2
  // segment D: t2..t2+duration → v2→v3
  // segment E: t2+duration.. → v3
  // We'll implement as a single Counter with conditional from/to:
  const frame = useScaledFrame();
  if (frame < t1) return <Counter from={v1} to={v1} startFrame={0} durationFrames={1} />;
  if (frame < t1 + duration) return <Counter from={v1} to={v2} startFrame={t1} durationFrames={duration} />;
  if (frame < t2) return <Counter from={v2} to={v2} startFrame={0} durationFrames={1} />;
  if (frame < t2 + duration) return <Counter from={v2} to={v3} startFrame={t2} durationFrames={duration} />;
  return <Counter from={v3} to={v3} startFrame={0} durationFrames={1} />;
}

// (was useCurrentFrameSafe wrapper — now replaced with useScaledFrame directly)

function computeFunnelWidths(frame: number, t1: number, t2: number) {
  const widths30 = { conversations: 100, responded: 72, qualified: 23 };
  const widths7 = { conversations: 100, responded: 80, qualified: 28 };
  const widthsCasa = { conversations: 100, responded: 77, qualified: 38 };
  const duration = 90;

  let from = widths30;
  let to = widths30;
  let startAt = 0;

  if (frame < t1) {
    return widths30;
  } else if (frame < t1 + duration) {
    from = widths30;
    to = widths7;
    startAt = t1;
  } else if (frame < t2) {
    return widths7;
  } else if (frame < t2 + duration) {
    from = widths7;
    to = widthsCasa;
    startAt = t2;
  } else {
    return widthsCasa;
  }

  const easeOpts = {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };
  return {
    conversations: interpolate(frame, [startAt, startAt + duration], [from.conversations, to.conversations], easeOpts),
    responded: interpolate(frame, [startAt, startAt + duration], [from.responded, to.responded], easeOpts),
    qualified: interpolate(frame, [startAt, startAt + duration], [from.qualified, to.qualified], easeOpts),
  };
}
