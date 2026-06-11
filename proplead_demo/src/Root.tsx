import "./index.css";
import { Composition } from "remotion";
import { Conversaciones } from "./compositions/Conversaciones";
import { LeadsCualificados } from "./compositions/LeadsCualificados";
import { LeadsBulk } from "./compositions/LeadsBulk";
import { Dashboard } from "./compositions/Dashboard";
import { CrearAnuncio, CREAR_ANUNCIO_TOTAL_FRAMES, STEP_DURATIONS } from "./compositions/CrearAnuncio";
import { MobileConversaciones } from "./mobile/compositions/MobileConversaciones";
import { MobileLeadsCualificados } from "./mobile/compositions/MobileLeadsCualificados";
import { MobileLeadsBulk } from "./mobile/compositions/MobileLeadsBulk";
import { MobileDashboard } from "./mobile/compositions/MobileDashboard";

const VIDEO_PROPS = {
  durationInFrames: 300, // 10 seconds @ 30fps. Compositions run on a virtual 600-frame timeline via useScaledFrame().
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

const MOBILE_PROPS = {
  durationInFrames: 300, // 10 seconds @ 30fps — mobile portrait 1080×1920
  fps: 30,
  width: 1080,
  height: 1920,
} as const;

const CREAR_ANUNCIO_BASE = {
  fps: 30,
  width: 1080,
  height: 1440,
} as const;

const CREAR_ANUNCIO_PROPS = {
  durationInFrames: CREAR_ANUNCIO_TOTAL_FRAMES,
  ...CREAR_ANUNCIO_BASE,
} as const;

const CREAR_ANUNCIO_VERTICAL_PROPS = {
  durationInFrames: CREAR_ANUNCIO_TOTAL_FRAMES,
  fps: 30,
  width: 1080,
  height: 1920,
} as const;

const CrearAnuncioStep1: React.FC = () => <CrearAnuncio step={1} />;
const CrearAnuncioStep2: React.FC = () => <CrearAnuncio step={2} />;
const CrearAnuncioStep3: React.FC = () => <CrearAnuncio step={3} />;
const CrearAnuncioStep4: React.FC = () => <CrearAnuncio step={4} />;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="conversaciones" component={Conversaciones} {...VIDEO_PROPS} />
      <Composition id="leads-cualificados" component={LeadsCualificados} {...VIDEO_PROPS} />
      <Composition id="leads-bulk" component={LeadsBulk} {...VIDEO_PROPS} />
      <Composition id="dashboard" component={Dashboard} {...VIDEO_PROPS} />
      <Composition id="crear-anuncio" component={CrearAnuncio} {...CREAR_ANUNCIO_PROPS} />
      <Composition id="crear-anuncio-vertical" component={CrearAnuncio} {...CREAR_ANUNCIO_VERTICAL_PROPS} />
      <Composition
        id="crear-anuncio-1"
        component={CrearAnuncioStep1}
        durationInFrames={STEP_DURATIONS[0]}
        {...CREAR_ANUNCIO_BASE}
      />
      <Composition
        id="crear-anuncio-2"
        component={CrearAnuncioStep2}
        durationInFrames={STEP_DURATIONS[1]}
        {...CREAR_ANUNCIO_BASE}
      />
      <Composition
        id="crear-anuncio-3"
        component={CrearAnuncioStep3}
        durationInFrames={STEP_DURATIONS[2]}
        {...CREAR_ANUNCIO_BASE}
      />
      <Composition
        id="crear-anuncio-4"
        component={CrearAnuncioStep4}
        durationInFrames={STEP_DURATIONS[3]}
        {...CREAR_ANUNCIO_BASE}
      />

      {/* Mobile versions (1080×1920 portrait) */}
      <Composition id="mobile-conversaciones" component={MobileConversaciones} {...MOBILE_PROPS} />
      <Composition id="mobile-leads-cualificados" component={MobileLeadsCualificados} {...MOBILE_PROPS} />
      <Composition id="mobile-leads-bulk" component={MobileLeadsBulk} {...MOBILE_PROPS} />
      <Composition id="mobile-dashboard" component={MobileDashboard} {...MOBILE_PROPS} />
    </>
  );
};
