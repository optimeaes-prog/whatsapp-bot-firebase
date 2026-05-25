import type { AuditLogEntry, AuditAction, AuditEntityType } from "../types";
import { FUNCTIONS_BASE_URL as API_URL } from "../lib/api";

export interface GetAuditLogsParams {
    entityType?: AuditEntityType;
    entityId?: string;
    action?: AuditAction;
    userId?: string;
    isSystemAction?: boolean;
    limit?: number;
}

export async function getAuditLogs(params?: GetAuditLogsParams): Promise<AuditLogEntry[]> {
    const queryParams = new URLSearchParams();

    if (params?.entityType) queryParams.append("entityType", params.entityType);
    if (params?.entityId) queryParams.append("entityId", params.entityId);
    if (params?.action) queryParams.append("action", params.action);
    if (params?.userId) queryParams.append("userId", params.userId);
    if (params?.isSystemAction !== undefined) queryParams.append("isSystemAction", String(params.isSystemAction));
    if (params?.limit) queryParams.append("limit", String(params.limit));

    const url = `${API_URL}/getAuditLogs${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.logs || [];
}
