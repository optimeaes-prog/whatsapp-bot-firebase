import axios from "axios";
import { defineString } from "firebase-functions/params";
import { WHAPI_TOKEN } from "../secrets";

const WHAPI_API_URL = defineString("WHAPI_API_URL");

type SendTextParams = {
  to: string;
  body: string;
  chatId?: string;
};

type SendTextResult = {
  chatId: string;
  messageId?: string;
};

export async function sendText(params: SendTextParams): Promise<SendTextResult> {
  const apiUrl = WHAPI_API_URL.value();
  const token = WHAPI_TOKEN.value();

  if (!apiUrl || !token) {
    throw new Error("WHAPI_API_URL or WHAPI_TOKEN not configured");
  }

  const payload: Record<string, unknown> = {
    to: params.to,
    body: params.body,
  };

  if (params.chatId) {
    payload.chatId = params.chatId;
  }

  const response = await axios.post(`${apiUrl}/messages/text`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = response.data;
  return {
    chatId: data.chat_id || data.chatId || params.chatId || "",
    messageId: data.message_id || data.messageId,
  };
}

export async function checkWhapiHealth(): Promise<{ status: string; details?: any }> {
  const apiUrl = WHAPI_API_URL.value();
  const token = WHAPI_TOKEN.value();

  if (!apiUrl || !token) {
    return { status: "error", details: "WHAPI_API_URL or WHAPI_TOKEN not configured" };
  }

  try {
    // Whapi health check or just getting bot info to verify connection
    const response = await axios.get(`${apiUrl}/health`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 5000, // 5 seconds timeout
    });

    return { status: "ok", details: response.data };
  } catch (error: any) {
    console.error("Whapi health check failed:", error.message);
    return {
      status: "error",
      details: error.response?.data || error.message
    };
  }
}

/**
 * Get list of chats from Whapi
 * @param params.count - Number of chats to retrieve (max 500, default 100)
 * @param params.offset - Offset for pagination
 */
export async function getChats(params?: {
  count?: number;
  offset?: number;
}): Promise<{ id: string; name?: string; type: string; timestamp: number; last_message?: any; unread?: number }[]> {
  const apiUrl = WHAPI_API_URL.value();
  const token = WHAPI_TOKEN.value();

  if (!apiUrl || !token) {
    throw new Error("WHAPI_API_URL or WHAPI_TOKEN not configured");
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.count) queryParams.append("count", String(params.count));
    if (params?.offset) queryParams.append("offset", String(params.offset));

    const url = `${apiUrl}/chats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000, // 30 seconds timeout for potentially large response
    });

    // Whapi returns { chats: [...] } or just an array
    const chats = response.data?.chats || response.data || [];
    return Array.isArray(chats) ? chats : [];
  } catch (error: any) {
    console.error("Failed to get chats from Whapi:", error.message);
    throw error;
  }
}

/**
 * Get messages from a specific chat
 * @param chatId - The chat ID to get messages from
 * @param params.count - Number of messages to retrieve (max 500, default 100)
 * @param params.time_from - Unix timestamp to get messages from
 * @param params.time_to - Unix timestamp to get messages until
 */
export async function getMessages(
  chatId: string,
  params?: {
    count?: number;
    time_from?: number;
    time_to?: number;
  }
): Promise<{ id: string; chat_id: string; from: string; from_me: boolean; timestamp: number; text?: { body: string }; body?: string }[]> {
  const apiUrl = WHAPI_API_URL.value();
  const token = WHAPI_TOKEN.value();

  if (!apiUrl || !token) {
    throw new Error("WHAPI_API_URL or WHAPI_TOKEN not configured");
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.count) queryParams.append("count", String(params.count));
    if (params?.time_from) queryParams.append("time_from", String(params.time_from));
    if (params?.time_to) queryParams.append("time_to", String(params.time_to));

    const url = `${apiUrl}/messages/list/${encodeURIComponent(chatId)}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 30000,
    });

    // Whapi returns { messages: [...] } or just an array
    const messages = response.data?.messages || response.data || [];
    return Array.isArray(messages) ? messages : [];
  } catch (error: any) {
    console.error(`Failed to get messages for chat ${chatId}:`, error.message);
    throw error;
  }
}

