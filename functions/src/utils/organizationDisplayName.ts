import type { DocumentData } from "firebase-admin/firestore";

/**
 * Label shown in emails / invitation preview: prefer `agencyName` on the org doc.
 * Legacy `name` on `organizations/{orgId}` is not read (removed from schema).
 */
export function organizationDisplayNameFromOrgDoc(params: {
  orgId: string;
  exists: boolean;
  data: DocumentData | undefined;
  /** When the org doc is missing or `agencyName` is empty */
  fallback?: string;
}): string {
  const fallback = params.fallback ?? "Proplead";
  const orgId = typeof params.orgId === "string" ? params.orgId.trim() : "";
  if (!params.exists || !params.data) {
    return orgId || fallback;
  }
  const agency = typeof params.data.agencyName === "string" ? params.data.agencyName.trim() : "";
  if (agency) return agency;
  return orgId || fallback;
}
