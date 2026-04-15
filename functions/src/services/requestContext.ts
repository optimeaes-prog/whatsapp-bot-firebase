import { AsyncLocalStorage } from "async_hooks";

export type RequestContextData = {
  orgId: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextData>();

export function getActiveOrgId(): string {
  const store = requestContext.getStore();
  // We should not have a global fallback to a specific user's org.
  // Legacy system tasks should explicitly set their context or we should handle missing context.
  return store?.orgId || ""; 
}
