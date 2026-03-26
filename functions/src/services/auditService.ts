import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { AuditLogEntry, AuditAction, AuditEntityType } from "../types";

const DATABASE_ID = "realestate-whatsapp-bot";

const getDb = () => {
    return getFirestore(admin.app(), DATABASE_ID);
};

const ORG_ID = "org_paco_granados";

const getOrgDb = () => {
  return getDb().collection("organizations").doc(ORG_ID);
};

/**
 * Record an audit log entry
 */
export async function recordAuditLog(params: {
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    userId?: string;
    userName?: string;
    isSystemAction?: boolean;
    changes?: { field: string; oldValue: any; newValue: any }[];
    metadata?: any;
}): Promise<void> {
    try {
        const auditEntry: Omit<AuditLogEntry, "id"> = {
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            userId: params.userId,
            userName: params.userName,
            isSystemAction: params.isSystemAction ?? !params.userId,
            changes: params.changes,
            metadata: params.metadata,
            timestamp: FieldValue.serverTimestamp() as any,
        };

        await getOrgDb().collection("audit_logs").add(auditEntry);
    } catch (error) {
        console.error("Error recording audit log:", error);
        // Don't throw - audit logging should not break the main operation
    }
}

/**
 * Get audit logs with optional filtering
 */
export async function getAuditLogs(params?: {
    entityType?: AuditEntityType;
    entityId?: string;
    action?: AuditAction;
    userId?: string;
    isSystemAction?: boolean;
    limit?: number;
    startAfter?: FirebaseFirestore.Timestamp;
}): Promise<AuditLogEntry[]> {
    try {
        let query: FirebaseFirestore.Query = getOrgDb().collection("audit_logs");

        // Apply filters
        if (params?.entityType) {
            query = query.where("entityType", "==", params.entityType);
        }
        if (params?.entityId) {
            query = query.where("entityId", "==", params.entityId);
        }
        if (params?.action) {
            query = query.where("action", "==", params.action);
        }
        if (params?.userId) {
            query = query.where("userId", "==", params.userId);
        }
        if (params?.isSystemAction !== undefined) {
            query = query.where("isSystemAction", "==", params.isSystemAction);
        }

        // Order by timestamp descending (most recent first)
        query = query.orderBy("timestamp", "desc");

        // Apply pagination
        if (params?.startAfter) {
            query = query.startAfter(params.startAfter);
        }

        // Limit results if provided
        if (params?.limit) {
            query = query.limit(params.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as AuditLogEntry[];
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        throw error;
    }
}

/**
 * Helper: Record a lead change
 */
export async function recordLeadChange(
    leadId: string,
    action: AuditAction,
    changes?: { field: string; oldValue: any; newValue: any }[],
    userId?: string,
    userName?: string
): Promise<void> {
    await recordAuditLog({
        entityType: "lead",
        entityId: leadId,
        action,
        changes,
        userId,
        userName,
    });
}

/**
 * Helper: Record a conversation change
 */
export async function recordConversationChange(
    conversationId: string,
    action: AuditAction,
    changes?: { field: string; oldValue: any; newValue: any }[],
    userId?: string,
    userName?: string
): Promise<void> {
    await recordAuditLog({
        entityType: "conversation",
        entityId: conversationId,
        action,
        changes,
        userId,
        userName,
    });
}

/**
 * Helper: Record a listing change
 */
export async function recordListingChange(
    listingId: string,
    action: AuditAction,
    changes?: { field: string; oldValue: any; newValue: any }[],
    userId?: string,
    userName?: string
): Promise<void> {
    await recordAuditLog({
        entityType: "listing",
        entityId: listingId,
        action,
        changes,
        userId,
        userName,
    });
}

/**
 * Helper: Record a system action
 */
export async function recordSystemAction(
    entityType: AuditEntityType,
    entityId: string,
    action: AuditAction,
    metadata?: any
): Promise<void> {
    await recordAuditLog({
        entityType,
        entityId,
        action,
        isSystemAction: true,
        metadata,
    });
}
