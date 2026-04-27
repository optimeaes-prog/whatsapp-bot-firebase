import { auth } from "../lib/firebase";

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export type BotTestCandidate = {
  listingCode: string;
  orgId?: string;
  description?: string;
  address?: string;
  price?: string | number;
  link?: string;
  confidence: number;
};

export type BotTestResponse = {
  kind: "none" | "match" | "candidates";
  candidates: BotTestCandidate[];
};

export async function resolveListingCandidates(params: {
  text: string;
  operationType?: "Venta" | "Alquiler";
}): Promise<BotTestResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be logged in");
  }
  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/botTestResolveListing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: params.text,
      operationType: params.operationType,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to resolve listing candidates");
  }
  return data as BotTestResponse;
}
