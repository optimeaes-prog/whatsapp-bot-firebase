import {
    getConversationByChatId,
    addFailedMessage,
    getRetryableFailedMessages,
    updateFailedMessageRetry,
    deleteFailedMessage,
    getStaleBuffers,
    logSyncResult,
    isChatIgnored,
} from "./firestore";
import { getChats } from "./whapiClient";
import { sendTextMessage } from "./messagingProvider";
import { sendAlert } from "./alertService";
import { SyncResult, SyncDiscrepancy } from "../types";
import * as admin from "firebase-admin";
import { getChatIdVariants } from "../utils";

// Constants
const SYNC_LOOKBACK_HOURS = 72; // Check conversations from last 72 hours
const STALE_BUFFER_THRESHOLD_MINUTES = 10; // Alert if buffer is older than 10 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MINUTES = 15;

/**
 * Main sync function - compares Whapi state with Firestore
 */
export async function syncConversationsWithWhapi(options: { silent?: boolean } = {}): Promise<SyncResult> {
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
        const { getActiveProvider } = await import("./messagingProvider");
        const activeProvider = await getActiveProvider();
        
        const discrepancies: SyncDiscrepancy[] = [];

        if (activeProvider === "twilio" || activeProvider === "cloud_api") {
            const providerLabel = activeProvider === "twilio" ? "Twilio" : "Cloud API";
            console.log(`${providerLabel} is active - skipping chat listing sync (provider does not support listing chats)`);

            // Still perform essential maintenance tasks
            const failedStats = await retryFailedMessages();
            result.failedMessagesRetried = failedStats.retried;

            // Check stale buffers
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

            // Handle discrepancies (alerts)
            if (discrepancies.length > 0 && !silent) {
                await sendAlert(
                    `Mantenimiento de ${providerLabel}`,
                    `Se detectaron ${discrepancies.length} temas pendientes (buffers atascados)`,
                    { examples: discrepancies.slice(0, 5), provider: activeProvider },
                    "warning"
                );
            }

            await logSyncResult(result);
            return result;
        }

        // Calculate lookback time for Whapi
        const since = new Date();
        since.setHours(since.getHours() - SYNC_LOOKBACK_HOURS);
        const sinceTimestamp = Math.floor(since.getTime() / 1000);

        // 1. Get all chats from Whapi
        let whapiChats;
        try {
            whapiChats = await getChats({ count: 500 });
            console.log(`Retrieved ${whapiChats.length} chats from Whapi`);
        } catch (error: any) {
            result.errors.push(`Failed to get chats from Whapi: ${error.message}`);
            if (!silent) {
                await sendAlert("Sync Error", "No se pudieron obtener los chats de Whapi", { error: error.message }, "critical");
            }
            return result;
        }

        // Filter to only include personal chats (not groups) from the last 72 hours
        const seenChatIds = new Set<string>();
        const recentChats = whapiChats.filter(chat => {
            if (seenChatIds.has(chat.id)) return false;
            const isPersonalChat = chat.type === "contact" || chat.id.includes("@c.us") || chat.id.includes("@s.whatsapp.net");
            const isRecent = chat.timestamp >= sinceTimestamp;
            if (isPersonalChat && isRecent) {
                seenChatIds.add(chat.id);
                return true;
            }
            return false;
        });

        console.log(`Filtered to ${recentChats.length} recent unique personal chats`);
        result.chatsChecked = recentChats.length;

        // 2. Check each chat against Firestore
        for (const whapiChat of recentChats) {
            try {
                if (await isChatIgnored(whapiChat.id)) continue;

                const variants = getChatIdVariants(whapiChat.id);
                let firestoreLastMessageTime = 0;
                let foundAny = false;
                let isFinished = false;

                for (const variant of variants) {
                    const conv = await getConversationByChatId(variant);
                    if (conv) {
                        foundAny = true;
                        if (conv.isFinished) isFinished = true;
                        const historyLength = conv.history?.length || 0;
                        if (historyLength > 0) {
                            const lastTimestamp = conv.history[historyLength - 1].timestamp;
                            if (lastTimestamp > firestoreLastMessageTime) firestoreLastMessageTime = lastTimestamp;
                        }
                        const pendingLength = conv.pendingUserMessages?.length || 0;
                        if (pendingLength > 0) {
                            const lastPendingTimestamp = conv.pendingUserMessages[pendingLength - 1].timestamp;
                            if (lastPendingTimestamp > firestoreLastMessageTime) firestoreLastMessageTime = lastPendingTimestamp;
                        }
                    }
                }

                if (!foundAny) {
                    if (whapiChat.last_message?.from_me) {
                        discrepancies.push({
                            chatId: whapiChat.id,
                            type: "missing_in_firestore",
                            details: `Chat exists in Whapi with our last message but not found in Firestore`,
                            whapiTimestamp: whapiChat.timestamp,
                        });
                    }
                    continue;
                }

                const whapiLastMessageTime = (whapiChat.last_message?.timestamp || whapiChat.timestamp) * 1000;
                const timeDiffMinutes = (whapiLastMessageTime - firestoreLastMessageTime) / (1000 * 60);
                const isSystemMessage = whapiChat.last_message?.type === 'action' || whapiChat.last_message?.source === 'system';

                if (timeDiffMinutes > 5 && !isFinished && whapiChat.last_message?.from_me !== true && !isSystemMessage) {
                    discrepancies.push({
                        chatId: whapiChat.id,
                        type: "message_mismatch",
                        details: `Whapi shows message ${Math.round(timeDiffMinutes)} minutes newer than Firestore`,
                        whapiTimestamp: whapiLastMessageTime,
                        firestoreTimestamp: firestoreLastMessageTime,
                    });
                }
            } catch (error: any) {
                result.errors.push(`Error checking chat ${whapiChat.id}: ${error.message}`);
            }
        }

        result.discrepanciesFound = discrepancies.length;

        // 3. Check for stale buffers
        const staleBuffers = await getStaleBuffers(STALE_BUFFER_THRESHOLD_MINUTES);
        for (const conv of staleBuffers) {
            discrepancies.push({
                chatId: conv.chatId,
                type: "stale_buffer",
                details: `Conversation has ${conv.pendingUserMessages?.length || 0} messages stuck in buffer for more than ${STALE_BUFFER_THRESHOLD_MINUTES} minutes`,
                firestoreTimestamp: conv.bufferExpiresAt,
            });
        }

        // 4. Handle discrepancies
        if (discrepancies.length > 0) {
            console.log(`Found ${discrepancies.length} discrepancies`);
            if (!silent) {
                const severity = discrepancies.length > 10 ? "critical" : discrepancies.length > 3 ? "warning" : "info";
                await sendAlert(
                    "Discrepancias de Sincronización Detectadas",
                    `Se encontraron ${discrepancies.length} temas pendientes entre Whapi y Firestore`,
                    { total: discrepancies.length, examples: discrepancies.slice(0, 5) },
                    severity
                );
            }
        } else {
            console.log("No discrepancies found - all good!");
        }

        await logSyncResult(result);

    } catch (error: any) {
        result.errors.push(`Sync failed: ${error.message}`);
        if (!silent) {
            await sendAlert("Sync Failed", "Error crítico durante la sincronización", { error: error.message }, "critical");
        }
    }

    console.log(`Sync completed: ${result.chatsChecked} chats checked, ${result.discrepanciesFound} discrepancies found`);
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
