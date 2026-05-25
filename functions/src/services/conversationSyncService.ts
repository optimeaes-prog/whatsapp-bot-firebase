import {
    addFailedMessage,
    getRetryableFailedMessages,
    updateFailedMessageRetry,
    deleteFailedMessage,
    getStaleBuffers,
    logSyncResult,
} from "./firestore";
import { sendTextMessage } from "./messagingProvider";
import { sendAlert } from "./alertService";
import { SyncResult, SyncDiscrepancy } from "../types";
import * as admin from "firebase-admin";

// Constants
const STALE_BUFFER_THRESHOLD_MINUTES = 10; // Alert if buffer is older than 10 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MINUTES = 15;

/**
 * Periodic maintenance: retry failed messages and flag conversations with
 * messages stuck in the inbound buffer. Providers (Twilio / Cloud API) do
 * not expose a chat-listing API, so there is no upstream state to diff.
 */
export async function syncConversations(options: { silent?: boolean } = {}): Promise<SyncResult> {
    const { silent = false } = options;
    const result: SyncResult = {
        timestamp: new Date(),
        chatsChecked: 0,
        discrepanciesFound: 0,
        messagesRecovered: 0,
        failedMessagesRetried: 0,
        errors: [],
    };

    console.log("Starting conversation sync...");

    try {
        const discrepancies: SyncDiscrepancy[] = [];

        const failedStats = await retryFailedMessages();
        result.failedMessagesRetried = failedStats.retried;

        const staleBuffers = await getStaleBuffers(STALE_BUFFER_THRESHOLD_MINUTES);
        for (const conv of staleBuffers) {
            discrepancies.push({
                chatId: conv.chatId,
                type: "stale_buffer",
                details: `Conversation has ${conv.pendingUserMessages?.length || 0} messages stuck in buffer for more than ${STALE_BUFFER_THRESHOLD_MINUTES} minutes`,
                firestoreTimestamp: conv.bufferExpiresAt,
            });
        }

        result.discrepanciesFound = discrepancies.length;

        if (discrepancies.length > 0 && !silent) {
            await sendAlert(
                "Mantenimiento de Proveedor",
                `Se detectaron ${discrepancies.length} temas pendientes (buffers atascados)`,
                { examples: discrepancies.slice(0, 5) },
                "warning"
            );
        }

        await logSyncResult(result);
    } catch (error: any) {
        result.errors.push(`Sync failed: ${error.message}`);
        if (!silent) {
            await sendAlert("Sync Failed", "Error crítico durante la sincronización", { error: error.message }, "critical");
        }
    }

    console.log(`Sync completed: ${result.discrepanciesFound} discrepancies found, ${result.failedMessagesRetried} failed messages retried`);
    return result;
}

/**
 * Retry failed messages from the queue
 */
export async function retryFailedMessages(): Promise<{ retried: number; succeeded: number; maxedOut: number }> {
    const stats = { retried: 0, succeeded: 0, maxedOut: 0 };

    console.log("Checking for failed messages to retry...");

    const failedMessages = await getRetryableFailedMessages();

    if (failedMessages.length === 0) {
        console.log("No failed messages to retry");
        return stats;
    }

    console.log(`Found ${failedMessages.length} failed message(s) to retry`);

    for (const msg of failedMessages) {
        stats.retried++;

        try {
            // Try to resend
            await sendTextMessage({ to: msg.phone, body: msg.body, chatId: msg.chatId });

            // Success! Delete from queue
            await deleteFailedMessage(msg.id);
            stats.succeeded++;
            console.log(`Successfully resent message to ${msg.chatId}`);

        } catch (error: any) {
            const newAttempt = msg.attempt + 1;

            if (newAttempt >= msg.maxAttempts) {
                // Max attempts reached - alert and remove
                stats.maxedOut++;
                await deleteFailedMessage(msg.id);
                await sendAlert(
                    "Mensaje Fallido Permanentemente",
                    `No se pudo enviar mensaje a ${msg.phone} después de ${msg.maxAttempts} intentos`,
                    { chatId: msg.chatId, body: msg.body.substring(0, 100), lastError: error.message },
                    "critical"
                );
            } else {
                // Schedule next retry
                const nextRetry = admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000)
                );
                await updateFailedMessageRetry(msg.id, {
                    attempt: newAttempt,
                    nextRetryAt: nextRetry,
                    lastError: error.message,
                });
                console.log(`Retry ${newAttempt}/${msg.maxAttempts} failed for ${msg.chatId}, next retry at ${nextRetry.toDate().toISOString()}`);
            }
        }
    }

    console.log(`Retry complete: ${stats.succeeded}/${stats.retried} succeeded, ${stats.maxedOut} permanently failed`);
    return stats;
}

/**
 * Queue a message for retry if sending failed
 */
export async function queueFailedMessage(
    chatId: string,
    phone: string,
    body: string,
    error: string
): Promise<void> {
    const nextRetry = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000)
    );

    await addFailedMessage({
        chatId,
        phone,
        body,
        attempt: 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        lastError: error,
        createdAt: admin.firestore.Timestamp.now(),
        nextRetryAt: nextRetry,
    });

    console.log(`Queued failed message for ${chatId}, will retry at ${nextRetry.toDate().toISOString()}`);
}
