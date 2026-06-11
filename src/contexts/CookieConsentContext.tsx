/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analytics } from "../lib/analytics";

export type CookieCategory = "necessary" | "analytics" | "marketing";

export type CookieConsentPrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

type StoredConsent = {
  analytics: boolean;
  marketing: boolean;
  version: number;
  decidedAt: number;
};

const STORAGE_KEY = "proplead_cookie_consent";

// Bump this when the meaning of the categories changes (e.g. new third-party
// added to the marketing category) so users are re-prompted.
export const CONSENT_VERSION = 1;

// 12 months — AEPD/CNIL standard. After this, banner reappears even if the
// user previously decided.
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

type ContextValue = {
  prefs: CookieConsentPrefs;
  hasDecided: boolean;
  isPreferencesOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (next: { analytics: boolean; marketing: boolean }) => void;
  openPreferences: () => void;
  closePreferences: () => void;
};

const DEFAULT_PREFS: CookieConsentPrefs = {
  necessary: true,
  analytics: false,
  marketing: false,
};

const CookieConsentContext = createContext<ContextValue | undefined>(undefined);

function readStored(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean" ||
      typeof parsed.version !== "number" ||
      typeof parsed.decidedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isStoredFresh(stored: StoredConsent): boolean {
  if (stored.version !== CONSENT_VERSION) return false;
  if (Date.now() - stored.decidedAt > CONSENT_TTL_MS) return false;
  return true;
}

function writeStored(prefs: { analytics: boolean; marketing: boolean }) {
  if (typeof window === "undefined") return;
  const payload: StoredConsent = {
    analytics: prefs.analytics,
    marketing: prefs.marketing,
    version: CONSENT_VERSION,
    decidedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be disabled (Safari private mode); silently ignore.
  }
}

function loadInitial(): {
  prefs: CookieConsentPrefs;
  hasDecided: boolean;
} {
  const stored = readStored();
  if (stored && isStoredFresh(stored)) {
    return {
      prefs: {
        necessary: true,
        analytics: stored.analytics,
        marketing: stored.marketing,
      },
      hasDecided: true,
    };
  }
  return { prefs: DEFAULT_PREFS, hasDecided: false };
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [{ prefs, hasDecided }, setState] = useState(loadInitial);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);

  const setPrefs = useCallback(
    (next: CookieConsentPrefs, decided: boolean) =>
      setState({ prefs: next, hasDecided: decided }),
    [],
  );

  // On mount: if a stored decision exists, sync it back to gtag (index.html
  // set everything to denied by default, so without this no analytics fire
  // for returning users even if they previously accepted).
  useEffect(() => {
    if (hasDecided) {
      analytics.updateConsent({
        analytics: prefs.analytics,
        marketing: prefs.marketing,
      });
    }
    // Run once; subsequent updates go through the apply() callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(
    (next: { analytics: boolean; marketing: boolean }) => {
      const hydrated: CookieConsentPrefs = { necessary: true, ...next };
      setPrefs(hydrated, true);
      setPreferencesOpen(false);
      writeStored(next);
      analytics.updateConsent(next);
    },
    [setPrefs],
  );

  const acceptAll = useCallback(
    () => apply({ analytics: true, marketing: true }),
    [apply],
  );

  const rejectAll = useCallback(
    () => apply({ analytics: false, marketing: false }),
    [apply],
  );

  const savePreferences = useCallback(
    (next: { analytics: boolean; marketing: boolean }) => apply(next),
    [apply],
  );

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  const value = useMemo<ContextValue>(
    () => ({
      prefs,
      hasDecided,
      isPreferencesOpen,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
    }),
    [
      prefs,
      hasDecided,
      isPreferencesOpen,
      acceptAll,
      rejectAll,
      savePreferences,
      openPreferences,
      closePreferences,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error(
      "useCookieConsent must be used within a CookieConsentProvider",
    );
  }
  return ctx;
}
