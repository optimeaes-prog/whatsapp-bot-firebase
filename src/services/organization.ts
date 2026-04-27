import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { auth } from "../lib/firebase";
import { getOrganizationId } from "../lib/organization";
import type { AssistantAvatarId } from "../constants/assistantAvatars";
import type { MessagingProvider } from "../types";

export interface OrganizationSettings {
  onboardingStep?: number;
  agencyName?: string;
  employeesCount?: string;
  whatsappSummariesPhone?: string;
  forwardingEmail?: string;
  assistantAvatarId?: AssistantAvatarId;
  assistantAvatarName?: string;
  assistantAvatarImagePath?: string;
  assistantAvatarUrl?: string;
  
  onboardingCallScheduled?: boolean;
  onboardingCallDate?: string;
  onboardingRescheduleUrl?: string;
}

export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const orgId = getOrganizationId();
  const docRef = doc(db, "organizations", orgId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as OrganizationSettings;
  } else {
    // Si no existe, lo creamos vacío
    await setDoc(docRef, { onboardingCallScheduled: false });
    return { onboardingCallScheduled: false };
  }
}

export async function updateOrganizationSettings(settings: Partial<OrganizationSettings>): Promise<void> {
  const orgId = getOrganizationId();
  const docRef = doc(db, "organizations", orgId);
  await updateDoc(docRef, settings as any);
}

export async function getPendingOnboards(): Promise<(OrganizationSettings & { id: string })[]> {
  const q = query(collection(db, "organizations"), where("onboardingStep", "==", 5));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as OrganizationSettings }));
}

export async function confirmOnboarding(orgId: string): Promise<void> {
  const docRef = doc(db, "organizations", orgId);
  await updateDoc(docRef, { onboardingStep: 6 });
}

export async function getAllOrganizations(): Promise<{ id: string; agencyName?: string }[]> {
  const snapshot = await getDocs(collection(db, "organizations"));
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    agencyName: doc.data().agencyName || doc.id 
  }));
}

export async function getAllOrganizationsForSuperAdmin(): Promise<{ id: string; agencyName?: string }[]> {
  const FUNCTIONS_BASE_URL =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
    "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/listOrganizationsForSuperAdmin`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}`);
  }
  const body = (await response.json()) as { organizations?: { id: string; agencyName?: string }[] };
  return Array.isArray(body.organizations) ? body.organizations : [];
}

export type GlobalMessagingPolicy = {
  defaultProvider: MessagingProvider;
  cloudApi?: {
    templates?: {
      callHandoffOrgEs?: string;
      callHandoffOrgEn?: string;
      agentNotification?: string;
    };
  };
  twilio?: {
    templates?: {
      callHandoffOrgEs?: string;
      callHandoffOrgEn?: string;
      voiceOptInConsent?: string;
      agentNotification?: string;
    };
  };
  version?: number;
  updatedBy?: string;
};

type SuperAdminOrgRow = {
  id: string;
  agencyName?: string;
  providerOverride?: MessagingProvider | null;
  effectiveProvider?: MessagingProvider;
  providerSource?: "org" | "global" | "fallback";
  platformDefaultProvider?: MessagingProvider;
};

export type HandoffReadinessResult = {
  ok: boolean;
  eligible: boolean;
  targetOrgId: string;
  provider: MessagingProvider;
  missingRequiredKeys: string[];
  checks: Array<{ key: string; ok: boolean; value?: string; note?: string }>;
};

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const FUNCTIONS_BASE_URL =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
    "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  return fetch(`${FUNCTIONS_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function getSuperAdminProviderOverview(): Promise<{
  organizations: SuperAdminOrgRow[];
  policy: GlobalMessagingPolicy;
}> {
  const [orgRes, policyRes] = await Promise.all([
    authedFetch("/listOrganizationsForSuperAdmin", { method: "GET" }),
    authedFetch("/getGlobalMessagingPolicyConfig", { method: "GET" }),
  ]);
  if (!orgRes.ok) throw new Error(`Error ${orgRes.status} cargando organizaciones`);
  if (!policyRes.ok) throw new Error(`Error ${policyRes.status} cargando política global`);
  const orgBody = (await orgRes.json()) as { organizations?: SuperAdminOrgRow[] };
  const policyBody = (await policyRes.json()) as { policy?: GlobalMessagingPolicy };
  return {
    organizations: Array.isArray(orgBody.organizations) ? orgBody.organizations : [],
    policy: (policyBody.policy || { defaultProvider: "twilio" }) as GlobalMessagingPolicy,
  };
}

export async function setGlobalDefaultProvider(provider: MessagingProvider): Promise<GlobalMessagingPolicy> {
  const response = await authedFetch("/setPlatformDefaultProviderConfig", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  const data = (await response.json()) as { policy: GlobalMessagingPolicy };
  return data.policy;
}

export async function updateGlobalProviderBehavior(payload: {
  cloudApiCallHandoffOrgEs?: string;
  cloudApiCallHandoffOrgEn?: string;
  twilioCallHandoffOrgEs?: string;
  twilioCallHandoffOrgEn?: string;
  twilioVoiceOptInConsent?: string;
  twilioAgentNotification?: string;
  cloudApiAgentNotification?: string;
}): Promise<GlobalMessagingPolicy> {
  const cloudTemplates: Record<string, string> = {};
  const twilioTemplates: Record<string, string> = {};
  if (payload.cloudApiCallHandoffOrgEs) cloudTemplates.callHandoffOrgEs = payload.cloudApiCallHandoffOrgEs.trim();
  if (payload.cloudApiCallHandoffOrgEn) cloudTemplates.callHandoffOrgEn = payload.cloudApiCallHandoffOrgEn.trim();
  if (payload.twilioCallHandoffOrgEs) twilioTemplates.callHandoffOrgEs = payload.twilioCallHandoffOrgEs.trim();
  if (payload.twilioCallHandoffOrgEn) twilioTemplates.callHandoffOrgEn = payload.twilioCallHandoffOrgEn.trim();
  if (payload.twilioVoiceOptInConsent) twilioTemplates.voiceOptInConsent = payload.twilioVoiceOptInConsent.trim();
  if (payload.twilioAgentNotification) twilioTemplates.agentNotification = payload.twilioAgentNotification.trim();
  if (payload.cloudApiAgentNotification) cloudTemplates.agentNotification = payload.cloudApiAgentNotification.trim();

  const response = await authedFetch("/setGlobalMessagingPolicyConfig", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cloudApi: { templates: cloudTemplates },
      twilio: { templates: twilioTemplates },
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  const data = (await response.json()) as { policy: GlobalMessagingPolicy };
  return data.policy;
}

export async function clearOrgProviderOverride(orgId: string): Promise<void> {
  const response = await authedFetch("/clearOrgMessagingProviderOverride", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
}

export async function getCallHandoffReadiness(orgId: string): Promise<HandoffReadinessResult> {
  const response = await authedFetch(`/callHandoffReadiness?orgId=${encodeURIComponent(orgId)}`, {
    method: "GET",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  return (await response.json()) as HandoffReadinessResult;
}

export async function backfillPerOrgTemplateEligibility(orgId?: string): Promise<{
  scanned: number;
  updated: number;
  blocked: number;
  rows: Array<{ orgId: string; eligible: boolean; missingRequiredKeys: string[] }>;
}> {
  const response = await authedFetch("/backfillPerOrgTemplateEligibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Error ${response.status}`);
  }
  return (await response.json()) as {
    scanned: number;
    updated: number;
    blocked: number;
    rows: Array<{ orgId: string; eligible: boolean; missingRequiredKeys: string[] }>;
  };
}
