import { listInboundMessages, TwilioMessage } from "./twilioClient";
import { getConversationByChatId, addPendingMessage, updateBufferTask } from "./firestore";
import { requestContext } from "./requestContext";
import { ensureConversationState } from "../index";
import { REGION, scheduleBufferTask } from "../shared";
import * as admin from "firebase-admin";

export type OrphanedMessage = {
  orgId: string;
  chatId: string;
  phone: string;
  body: string;
  timestamp: number;
  sid: string;
};

/**
 * Identifies messages from Twilio that are not present in Firestore
 */
export async function getOrphanedMessages(hours: number, orgId: string): Promise<OrphanedMessage[]> {
  console.log(`Searching for orphaned messages in the last ${hours} hours...`);
  const inbound = await listInboundMessages({ lookbackHours: hours });
  console.log(`Fetched ${inbound.length} inbound messages from Twilio.`);

  const orphans: OrphanedMessage[] = [];

  // Group by chatId to minimize DB lookups
  const messagesByChat = new Map<string, TwilioMessage[]>();
  for (const msg of inbound) {
    const chatMessages = messagesByChat.get(msg.chatId) || [];
    chatMessages.push(msg);
    messagesByChat.set(msg.chatId, chatMessages);
  }

  for (const [chatId, messages] of messagesByChat.entries()) {
    await requestContext.run({ orgId }, async () => {
      // 2. Fetch conversation state
      const state = await getConversationByChatId(chatId);
      
      for (const msg of messages) {
        let exists = false;
        
        if (state) {
          // Check history
          const inHistory = (state.history || []).some(h => h.text === msg.body);
          // Check pending buffer
          const inBuffer = (state.pendingUserMessages || []).some(p => p.text === msg.body);
          
          if (inHistory || inBuffer) {
            exists = true;
          }
        }

        if (!exists) {
          orphans.push({
            orgId,
            chatId: msg.chatId,
            phone: msg.phone,
            body: msg.body,
            timestamp: msg.timestamp,
            sid: msg.sid
          });
        }
      }
    });
  }

  return orphans;
}

/**
 * Re-injects orphaned messages into the system
 */
export async function reprocessOrphans(orphans: OrphanedMessage[]): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const orphan of orphans) {
    try {
      await requestContext.run({ orgId: orphan.orgId }, async () => {
        // Ensure state exists
        const state = await ensureConversationState(orphan.chatId, orphan.phone);
        if (!state) {
          throw new Error(`Could not ensure state for ${orphan.chatId}`);
        }

        const canonicalChatId = state.chatId;

        // Ingest into buffer
        await addPendingMessage(canonicalChatId, {
          text: orphan.body,
          timestamp: orphan.timestamp
        });

        // Schedule processing
        const processUrl = `https://${REGION}-${admin.instanceId().app.options.projectId}.cloudfunctions.net/processBuffer`;
        const { taskName, scheduledTime } = await scheduleBufferTask(
          canonicalChatId, 
          processUrl, 
          state.pendingTaskName, 
          orphan.orgId
        );

        await updateBufferTask(canonicalChatId, taskName, scheduledTime);
        processed++;
      });
    } catch (err) {
      console.error(`Error reprocessing orphan ${orphan.sid}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}
