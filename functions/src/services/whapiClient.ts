import axios from "axios";
import { defineString } from "firebase-functions/params";

const WHAPI_API_URL = defineString("WHAPI_API_URL");
const WHAPI_TOKEN = defineString("WHAPI_TOKEN");

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
