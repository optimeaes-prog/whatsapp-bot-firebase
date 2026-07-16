import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export async function resolveOrgIdFromToken(authHeader?: string): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;

  const DATABASE_ID = "realestate-whatsapp-bot";
  const userDoc = await getFirestore(admin.app(), DATABASE_ID).collection("users").doc(uid).get();
  const orgId = userDoc.data()?.orgId;

  if (!orgId) {
    throw new Error("Organization not found for user");
  }
  return orgId;
}

export async function resolveUserContextFromToken(authHeader?: string): Promise<{
  uid: string;
  orgId: string;
  role: string;
  email: string;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : "";
  const DATABASE_ID = "realestate-whatsapp-bot";
  const userRef = getFirestore(admin.app(), DATABASE_ID).collection("users").doc(uid);
  const userDoc = await userRef.get();
  const data = userDoc.data() || {};
  const orgId = typeof data.orgId === "string" ? data.orgId : "";
  const role = typeof data.role === "string" ? data.role : "";

  if (!orgId && role !== "super_admin") throw new Error("Organization not found for user");
  return { uid, orgId, role, email };
}

export async function resolveAuthIdentityFromToken(authHeader?: string): Promise<{ uid: string; email: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : "";
  return { uid, email };
}
