import { auth } from "../lib/firebase";

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export type SystemUser = {
  uid: string;
  email: string;
  displayName: string;
  creationTime: string;
  lastSignInTime: string;
};

export async function getSystemUsers(): Promise<SystemUser[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getSystemUsers`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch system users: ${response.status}`);
  }

  const data = await response.json();
  return data.users || [];
}
