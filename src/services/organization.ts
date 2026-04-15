import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getOrganizationId } from "../lib/organization";

export interface OrganizationSettings {
  onboardingStep?: number;
  agencyName?: string;
  employeesCount?: string;
  whatsappSummariesPhone?: string;
  forwardingEmail?: string;
  
  onboardingCallScheduled?: boolean;
  onboardingCallDate?: string;
  onboardingRescheduleUrl?: string;
}

export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const orgId = getOrganizationId();
  const docRef = doc(db, "organizations", orgId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as OrganizationSettings;
  } else {
    // Si no existe, lo creamos vacío
    await setDoc(docRef, { onboardingCallScheduled: false });
    return { onboardingCallScheduled: false };
  }
}

export async function updateOrganizationSettings(settings: Partial<OrganizationSettings>): Promise<void> {
  const orgId = getOrganizationId();
  const docRef = doc(db, "organizations", orgId);
  await updateDoc(docRef, settings as any);
}

export async function getPendingOnboards(): Promise<(OrganizationSettings & { id: string })[]> {
  const q = query(collection(db, "organizations"), where("onboardingStep", "==", 5));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as OrganizationSettings }));
}

export async function confirmOnboarding(orgId: string): Promise<void> {
  const docRef = doc(db, "organizations", orgId);
  await updateDoc(docRef, { onboardingStep: 6 });
}

export async function getAllOrganizations(): Promise<{ id: string; agencyName?: string }[]> {
  const snapshot = await getDocs(collection(db, "organizations"));
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    agencyName: doc.data().agencyName || doc.id 
  }));
}
