import type { Conversation, QualificationStatus } from "../types";

export type ResolvedConversationQualification = "qualified" | "rejected" | "pending";

/**
 * Resolves UI qualification for a conversation. Firestore may store `qualificationStatus: null`
 * on the conversation doc (meaning “still open”); that must not be treated as “not interested”.
 * Optional lead / qualified-chat set align the UI with the leads collection when available.
 */
export function resolveConversationQualification(
  conv: Conversation,
  options?: {
    qualifiedChatIds?: Set<string>;
    leadQualificationStatus?: QualificationStatus;
  }
): ResolvedConversationQualification {
  const leadSt = options?.leadQualificationStatus;
  if (leadSt === "qualified") return "qualified";
  if (leadSt === "rejected") return "rejected";

  const docQ = (conv as Conversation & { qualificationStatus?: boolean | null }).qualificationStatus;
  const inQualifiedSet = options?.qualifiedChatIds?.has(conv.chatId) ?? false;

  if (inQualifiedSet || conv.qualified === true || docQ === true) {
    return "qualified";
  }
  if (conv.qualified === false || docQ === false) {
    return "rejected";
  }
  return "pending";
}
