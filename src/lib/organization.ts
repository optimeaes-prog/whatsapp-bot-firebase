export const DEFAULT_ORGANIZATION_ID = "";
export const DEFAULT_ORGANIZATION_NAME = "Cargando...";

let currentOrganizationId = DEFAULT_ORGANIZATION_ID;

/**
 * Updates the global active organization ID at runtime.
 */
export function setOrganizationId(orgId: string) {
  currentOrganizationId = orgId;
}

/**
 * Returns the currently active organization from the context/global state.
 */
export function getOrganizationId(): string {
  return currentOrganizationId;
}

/**
 * Returns the base path for collections in Firestore.
 * E.g. "organizations/org_paco_granados" or "organizations/Q2x8m"
 */
export function getOrganizationBasePath(): string {
  return `organizations/${getOrganizationId()}`;
}
