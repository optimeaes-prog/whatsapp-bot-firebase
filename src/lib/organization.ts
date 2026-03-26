export const DEFAULT_ORGANIZATION_ID = "org_paco_granados";
export const DEFAULT_ORGANIZATION_NAME = "Paco Granados - Real Estate Agent";

/**
 * For now we use a single hardcoded organization.
 * In the future, this can be retrieved from an Auth/Organization context.
 */
export function getOrganizationId(): string {
  return DEFAULT_ORGANIZATION_ID;
}

/**
 * Returns the base path for collections in Firestore.
 * E.g. "organizations/org_paco_granados"
 */
export function getOrganizationBasePath(): string {
  return `organizations/${getOrganizationId()}`;
}
