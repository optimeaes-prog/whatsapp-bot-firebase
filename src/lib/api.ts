// Centralized Cloud Functions base URL. Use this everywhere instead of
// hardcoding the cloudfunctions.net URL. Override via VITE_API_URL in dev.
//
// The GCP project ID and region are already exposed via src/lib/firebase.ts
// (firebaseConfig is intentionally public on web), so this is hygiene, not a
// security boundary.
const DEFAULT_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export const FUNCTIONS_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_URL;
