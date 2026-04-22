import { auth } from "../lib/firebase";

const FUNCTIONS_BASE_URL =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
  "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

type EmbeddedSignupConfig = {
  appId: string;
  configId: string;
  graphApiVersion: string;
};

type SessionInfoResponse = {
  type: "WA_EMBEDDED_SIGNUP";
  event: "FINISH" | "CANCEL" | "ERROR" | string;
  data?: {
    phone_number_id?: string;
    waba_id?: string;
    business_id?: string;
    error_message?: string;
    current_step?: string;
  };
};

export type EmbeddedSignupResult = {
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: {
          authResponse?: { code?: string } | null;
          status?: string;
        }) => void,
        opts: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para conectar WhatsApp");
  return user.getIdToken();
}

export async function fetchEmbeddedSignupConfig(): Promise<EmbeddedSignupConfig> {
  const token = await getAuthToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getEmbeddedSignupConfig`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`No se pudo cargar la configuración de Meta (${response.status})`);
  }
  return response.json();
}

let sdkLoadPromise: Promise<void> | null = null;
export function loadFacebookSdk(appId: string): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v23.0" });
      resolve();
      return;
    }
    window.fbAsyncInit = () => {
      try {
        window.FB!.init({ appId, cookie: true, xfbml: false, version: "v23.0" });
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    const existing = document.getElementById("facebook-jssdk");
    if (existing) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("No se pudo cargar el SDK de Facebook"));
    document.body.appendChild(script);
  });
  return sdkLoadPromise;
}

/**
 * Launch the Embedded Signup popup and resolve with the WABA and phone number
 * the customer selected, along with the short-lived `code` to exchange on the
 * server. Rejects if the user cancels or Meta reports an error.
 */
export function launchEmbeddedSignup(
  configId: string
): Promise<{ code: string; phoneNumberId: string; wabaId: string }> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error("Facebook SDK no inicializado"));
      return;
    }

    let sessionInfo: { phoneNumberId?: string; wabaId?: string } = {};

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      let payload: SessionInfoResponse | null = null;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") return;
      if (payload.event === "FINISH" && payload.data) {
        sessionInfo = {
          phoneNumberId: payload.data.phone_number_id,
          wabaId: payload.data.waba_id,
        };
      } else if (payload.event === "CANCEL") {
        cleanup();
        reject(new Error("Conexión cancelada por el usuario"));
      } else if (payload.event === "ERROR") {
        cleanup();
        reject(new Error(payload.data?.error_message || "Error en la conexión con Meta"));
      }
    };

    const cleanup = () => window.removeEventListener("message", messageHandler);
    window.addEventListener("message", messageHandler);

    window.FB.login(
      (response) => {
        cleanup();
        const code = response?.authResponse?.code;
        if (!code) {
          reject(new Error("No se recibió el código de autorización de Meta"));
          return;
        }
        if (!sessionInfo.phoneNumberId || !sessionInfo.wabaId) {
          reject(
            new Error(
              "Meta no devolvió los datos del WhatsApp Business Account. Reinténtalo."
            )
          );
          return;
        }
        resolve({
          code,
          phoneNumberId: sessionInfo.phoneNumberId,
          wabaId: sessionInfo.wabaId,
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  });
}

export async function exchangeEmbeddedSignupCode(params: {
  code: string;
  phoneNumberId: string;
  wabaId: string;
}): Promise<EmbeddedSignupResult> {
  const token = await getAuthToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/exchangeEmbeddedSignupCode`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const err = (await response.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = (await response.json()) as EmbeddedSignupResult;
  return data;
}

/** One-shot helper used by the UI. */
export async function runEmbeddedSignup(): Promise<EmbeddedSignupResult> {
  const config = await fetchEmbeddedSignupConfig();
  await loadFacebookSdk(config.appId);
  const { code, phoneNumberId, wabaId } = await launchEmbeddedSignup(config.configId);
  return exchangeEmbeddedSignupCode({ code, phoneNumberId, wabaId });
}
