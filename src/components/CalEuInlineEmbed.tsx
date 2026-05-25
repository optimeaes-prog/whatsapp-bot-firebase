import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

const NAMESPACE = "15min";
const DEFAULT_CAL_LINK = "ejpr-proplead/15min";

/** Host por defecto: Cal.eu (el mismo slug en cal.com suele dar 404). */
const DEFAULT_CAL_ORIGIN = "https://app.cal.eu";
const DEFAULT_EMBED_JS_URL = "https://app.cal.eu/embed/embed.js";

function getCalLink(): string {
  const v = import.meta.env.VITE_CAL_COM_CAL_LINK as string | undefined;
  return v && v.length > 0 ? v : DEFAULT_CAL_LINK;
}

function getCalOrigin(): string {
  const v = import.meta.env.VITE_CAL_ORIGIN as string | undefined;
  return v && v.length > 0 ? v : DEFAULT_CAL_ORIGIN;
}

function getEmbedJsUrl(): string {
  const v = import.meta.env.VITE_CAL_EMBED_JS_URL as string | undefined;
  return v && v.length > 0 ? v : DEFAULT_EMBED_JS_URL;
}

export function CalEuInlineEmbed({
  namespace = NAMESPACE,
  calLink: calLinkProp,
  minHeight = 600,
  className,
}: {
  namespace?: string;
  calLink?: string;
  minHeight?: number;
  className?: string;
}) {
  const calLink = calLinkProp && calLinkProp.length > 0 ? calLinkProp : getCalLink();
  const calOrigin = getCalOrigin();
  const embedJsUrl = getEmbedJsUrl();

  useEffect(() => {
    void (async function () {
      const cal = await getCalApi({ namespace, embedJsUrl });
      cal("ui", {
        theme: "light",
        cssVarsPerTheme: {
          light: {
            "cal-brand": "#FFB03F",
          },
          dark: {
            "cal-brand": "#FFB03F",
          },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, [embedJsUrl, namespace]);

  return (
    <div
      className={[
        "w-full rounded-xl border border-slate-200/80 bg-white overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight }}
    >
      <Cal
        namespace={namespace}
        calLink={calLink}
        calOrigin={calOrigin}
        embedJsUrl={embedJsUrl}
        style={{ width: "100%", height: "100%", minHeight, overflow: "scroll" }}
        config={{
          layout: "month_view",
          useSlotsViewOnSmallScreen: "true",
          theme: "light",
        }}
      />
    </div>
  );
}
