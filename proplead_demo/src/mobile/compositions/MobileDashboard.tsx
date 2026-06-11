import { AbsoluteFill, Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { MobileShell } from "../MobileShell";
import { MobileDashboardPage } from "../MobileDashboardPage";
import { TouchIndicator, type TapKeyframe } from "../TouchIndicator";
import { Counter } from "../../ui/Counter";
import { useScaledFrame } from "../../shell/useScaledFrame";
import { METRICS_30D, METRICS_7D, METRICS_CASA_ALGARROBO } from "../../data/mockMetrics";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"] });

// Mobile layout coords (1080x1920). Filter pills are in a row at the top.
// FECHA pill: left half (24px-540px), ANUNCIO pill: right half (552px-1056px).
// Pills are at approximately y ~ 234 (after status bar 72 + header 140 + page padding 20 + half pill).
const FECHA_FILTER = { x: 280, y: 254 };
const FECHA_OPTION_7D = { x: 280, y: 410 };
const ANUNCIO_FILTER = { x: 800, y: 254 };
const ANUNCIO_OPTION_CASA = { x: 800, y: 460 };

const TAPS: TapKeyframe[] = [
  { frame: 160, x: FECHA_FILTER.x, y: FECHA_FILTER.y },
  { frame: 210, x: FECHA_OPTION_7D.x, y: FECHA_OPTION_7D.y },
  { frame: 375, x: ANUNCIO_FILTER.x, y: ANUNCIO_FILTER.y },
  { frame: 430, x: ANUNCIO_OPTION_CASA.x, y: ANUNCIO_OPTION_CASA.y },
];

export function MobileDashboard() {
  const frame = useScaledFrame();

  const fechaClickAt = 160;
  const fechaPickAt = 210;
  const anuncioClickAt = 375;
  const anuncioPickAt = 430;

  const dateDropdownOpen = frame >= fechaClickAt && frame < fechaPickAt + 6;
  const listingDropdownOpen = frame >= anuncioClickAt && frame < anuncioPickAt + 6;
  const dateHover = dateDropdownOpen && frame >= 195 ? 1 : undefined;
  const listingHover = listingDropdownOpen && frame >= 415 ? 2 : undefined;

  const dateLabel = frame < fechaPickAt ? "Últimos 30 días" : "Últimos 7 días";
  const listingLabel = frame < anuncioPickAt ? "Todos" : "Casa Algarrobo";

  const dateHighlight = frame >= fechaClickAt - 4 && frame < fechaPickAt + 14;
  const listingHighlight = frame >= anuncioClickAt - 4 && frame < anuncioPickAt + 14;

  const recentLeads: "all30d" | "all7d" | "casaAlgarrobo" =
    frame < fechaPickAt ? "all30d" : frame < anuncioPickAt ? "all7d" : "casaAlgarrobo";

  const funnelWidths = computeFunnelWidths(frame, fechaPickAt, anuncioPickAt);

  const counter = (v1: number, v2: number, v3: number) => (
    <DoubleCounter v1={v1} v2={v2} v3={v3} t1={fechaPickAt} t2={anuncioPickAt} />
  );

  return (
    <AbsoluteFill style={{ fontFamily, background: "white" }}>
      <MobileShell>
        <MobileDashboardPage
          dateLabel={dateLabel}
          listingLabel={listingLabel}
          qualRate={counter(METRICS_30D.qualificationRate, METRICS_7D.qualificationRate, METRICS_CASA_ALGARROBO.qualificationRate)}
          responseRate={counter(METRICS_30D.responseRate, METRICS_7D.responseRate, METRICS_CASA_ALGARROBO.responseRate)}
          leads={counter(METRICS_30D.leads, METRICS_7D.leads, METRICS_CASA_ALGARROBO.leads)}
          messages={counter(METRICS_30D.messages, METRICS_7D.messages, METRICS_CASA_ALGARROBO.messages)}
          funnel={{
            conversations: counter(METRICS_30D.funnel.conversations, METRICS_7D.funnel.conversations, METRICS_CASA_ALGARROBO.funnel.conversations),
            responded: counter(METRICS_30D.funnel.responded, METRICS_7D.funnel.responded, METRICS_CASA_ALGARROBO.funnel.responded),
            qualified: counter(METRICS_30D.funnel.qualified, METRICS_7D.funnel.qualified, METRICS_CASA_ALGARROBO.funnel.qualified),
          }}
          funnelWidths={funnelWidths}
          recentLeads={recentLeads}
          dateDropdownOpen={dateDropdownOpen}
          listingDropdownOpen={listingDropdownOpen}
          dateHover={dateHover}
          listingHover={listingHover}
          dateHighlight={dateHighlight}
          listingHighlight={listingHighlight}
        />
      </MobileShell>
      <TouchIndicator taps={TAPS} frame={frame} />
    </AbsoluteFill>
  );
}

function DoubleCounter({ v1, v2, v3, t1, t2, duration = 90 }: { v1: number; v2: number; v3: number; t1: number; t2: number; duration?: number }) {
  const frame = useScaledFrame();
  if (frame < t1) return <Counter from={v1} to={v1} startFrame={0} durationFrames={1} frame={frame} />;
  if (frame < t1 + duration) return <Counter from={v1} to={v2} startFrame={t1} durationFrames={duration} frame={frame} />;
  if (frame < t2) return <Counter from={v2} to={v2} startFrame={0} durationFrames={1} frame={frame} />;
  if (frame < t2 + duration) return <Counter from={v2} to={v3} startFrame={t2} durationFrames={duration} frame={frame} />;
  return <Counter from={v3} to={v3} startFrame={0} durationFrames={1} frame={frame} />;
}

function computeFunnelWidths(frame: number, t1: number, t2: number) {
  const widths30 = { conversations: 100, responded: 72, qualified: 23 };
  const widths7 = { conversations: 100, responded: 80, qualified: 28 };
  const widthsCasa = { conversations: 100, responded: 77, qualified: 38 };
  const duration = 90;

  let from = widths30;
  let to = widths30;
  let startAt = 0;

  if (frame < t1) return widths30;
  if (frame < t1 + duration) {
    from = widths30; to = widths7; startAt = t1;
  } else if (frame < t2) return widths7;
  else if (frame < t2 + duration) {
    from = widths7; to = widthsCasa; startAt = t2;
  } else return widthsCasa;

  const easeOpts = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  return {
    conversations: interpolate(frame, [startAt, startAt + duration], [from.conversations, to.conversations], easeOpts),
    responded: interpolate(frame, [startAt, startAt + duration], [from.responded, to.responded], easeOpts),
    qualified: interpolate(frame, [startAt, startAt + duration], [from.qualified, to.qualified], easeOpts),
  };
}
