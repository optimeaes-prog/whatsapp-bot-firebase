import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { analytics } from "../lib/analytics";

/**
 * Tracks SPA navigation as GA4 page_view events.
 *
 * Skips the initial mount: the first page_view is already emitted by the
 * `gtag('config', ...)` call in index.html. Firing again from here would
 * cause a duplicate hit at session start.
 */
export function usePageTracking() {
  const location = useLocation();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    analytics.trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
