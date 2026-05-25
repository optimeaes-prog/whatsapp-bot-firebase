import "./index.css";
import { Composition } from "remotion";
import { Conversaciones } from "./compositions/Conversaciones";
import { LeadsCualificados } from "./compositions/LeadsCualificados";
import { LeadsBulk } from "./compositions/LeadsBulk";
import { Dashboard } from "./compositions/Dashboard";
import { CrearAnuncio, CREAR_ANUNCIO_TOTAL_FRAMES } from "./compositions/CrearAnuncio";

const VIDEO_PROPS = {
  durationInFrames: 300, // 10 seconds @ 30fps. Compositions run on a virtual 600-frame timeline via useScaledFrame().
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

const CREAR_ANUNCIO_PROPS = {
  durationInFrames: CREAR_ANUNCIO_TOTAL_FRAMES,
  fps: 30,
  width: 1080,
  height: 1440,
} as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="conversaciones" component={Conversaciones} {...VIDEO_PROPS} />
      <Composition id="leads-cualificados" component={LeadsCualificados} {...VIDEO_PROPS} />
      <Composition id="leads-bulk" component={LeadsBulk} {...VIDEO_PROPS} />
      <Composition id="dashboard" component={Dashboard} {...VIDEO_PROPS} />
      <Composition id="crear-anuncio" component={CrearAnuncio} {...CREAR_ANUNCIO_PROPS} />
    </>
  );
};
