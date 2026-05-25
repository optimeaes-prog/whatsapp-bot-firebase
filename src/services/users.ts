import { auth, db } from "../lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export type SystemUser = {
  uid: string;
  email: string;
  name?: string;
  displayName?: string;
  role: string;
  orgId: string;
  createdAt?: string;
  creationTime?: string;
  lastSignInTime?: string;
  /** Comma-separated WhatsApp numbers for qualified-lead summaries when assigned to a listing (non-members). */
  qualifiedLeadNotificationNumbers?: string;
};

export type Invitation = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
};

export type UpdateTeamMemberParams = {
  orgId: string;
  userId: string;
  name: string;
  /** owner/super_admin only when caller is super_admin (role unchanged). */
  role: "member" | "agent" | "admin" | "owner" | "super_admin";
  qualifiedLeadNotificationNumbers?: string;
};

export async function getSystemUsers(): Promise<SystemUser[]> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/getSystemUsers`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch system users: ${response.status}`);
  const data = await response.json();
  return data.users || [];
}

export async function getOrgMembers(orgId: string): Promise<SystemUser[]> {
  const q = query(collection(db, "users"), where("orgId", "==", orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as SystemUser));
}

export async function getOrgInvitations(orgId: string): Promise<Invitation[]> {
  const q = query(collection(db, "invitations"), where("orgId", "==", orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation));
}

export async function sendInvitation(params: { email: string; name: string; role: string }): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sendInvitation`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send invitation");
  }
}

export async function updateTeamMember(params: UpdateTeamMemberParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/updateTeamMember`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to update team member");
  }
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, "invitations", invitationId));
}

export async function removeUserFromOrg(userId: string): Promise<void> {
  // En este sistema, borrar el usuario de la org es básicamente borrar su perfil o quitarle el orgId
  // Por ahora lo borramos si el usuario lo confirma, pero el negocio dice que "solo el owner puede eliminar la cuenta"
  await deleteDoc(doc(db, "users", userId));
}
