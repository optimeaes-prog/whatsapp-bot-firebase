import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import type { Listing, ListingFormData, ListingClosureReason, ListingClosureInfo } from "../types";

import { getOrganizationBasePath } from "../lib/organization";

// Function to get the current collection path dynamically
function getListingsCollection() {
  return `${getOrganizationBasePath()}/listings`;
}

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function getListings(): Promise<Listing[]> {
  try {
    const currentUser = auth.currentUser;
    console.log("Current user:", currentUser?.email || "NOT AUTHENTICATED");

    if (!currentUser) {
      throw new Error("Usuario no autenticado. Por favor, inicia sesión.");
    }

    console.log("Fetching listings (timeout: 60s)...");
    const colRef = collection(db, getListingsCollection());

    const snapshot = await withTimeout(getDocs(colRef), 60000, "getListings");
    console.log(`Fetched ${snapshot.docs.length} listings`);

    const listings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Listing[];
    return listings.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error fetching listings:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.name, error.message);
    }
    throw error;
  }
}

export async function getListingsForAgent(uid: string): Promise<Listing[]> {
  const agentUid = uid.trim();
  if (!agentUid) return [];

  const colRef = collection(db, getListingsCollection());
  const [assignedRes, createdRes] = await Promise.allSettled([
    getDocs(query(colRef, where("assignedAgentUid", "==", agentUid))),
    getDocs(query(colRef, where("createdByUid", "==", agentUid))),
  ]);

  if (assignedRes.status === "rejected") {
    const err = assignedRes.reason as { name?: string; code?: string; message?: string };
    console.error("[Listings] agent query (assignedAgentUid) failed", {
      uidTail: agentUid.slice(-6),
      errName: err?.name,
      errCode: err?.code,
      errMsg: String(err?.message || assignedRes.reason),
    });
  }
  if (createdRes.status === "rejected") {
    const err = createdRes.reason as { name?: string; code?: string; message?: string };
    console.error("[Listings] agent query (createdByUid) failed", {
      uidTail: agentUid.slice(-6),
      errName: err?.name,
      errCode: err?.code,
      errMsg: String(err?.message || createdRes.reason),
    });
  }

  const assignedSnap = assignedRes.status === "fulfilled" ? assignedRes.value : null;
  const createdSnap = createdRes.status === "fulfilled" ? createdRes.value : null;

  const byId = new Map<string, Listing>();
  for (const snap of [assignedSnap, createdSnap]) {
    if (!snap) continue;
    for (const d of snap.docs) {
      byId.set(d.id, { id: d.id, ...d.data() } as Listing);
    }
  }

  const listings = Array.from(byId.values());
  return listings.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

export async function getListingById(id: string): Promise<Listing | null> {
  const docRef = doc(db, getListingsCollection(), id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Listing;
}

export async function getListingByCode(listingCode: string): Promise<Listing | null> {
  const q = query(collection(db, getListingsCollection()));
  const snapshot = await getDocs(q);
  const found = snapshot.docs.find((doc) => doc.data().listingCode === listingCode);
  if (!found) {
    return null;
  }
  return { id: found.id, ...found.data() } as Listing;
}

export async function createListing(data: ListingFormData): Promise<string> {
  const now = Timestamp.now();
  try {
    const currentUser = auth.currentUser;
    console.log("Creating listing for user:", currentUser?.email);
    console.log("Data:", JSON.stringify(data));

    const docRef = await withTimeout(
      addDoc(collection(db, getListingsCollection()), {
        description: data.description,
        listingCode: data.listingCode,
        listingCodeFotocasa: (data as any).listingCodeFotocasa || "",
        referencia: (data as any).referencia,
        link: data.link,
        operationType: data.operationType,
        features: data.features,
        idealistaDescription: (data as any).idealistaDescription || "",
        rentalSubtype: (data as any).rentalSubtype || "No aplica",
        quickQualificationEnabled: (data as any).quickQualificationEnabled === true,
        createdByUid: (data as any).createdByUid || "",
        assignedAgentUid: (data as any).assignedAgentUid || "",
        assignedAgentName: (data as any).assignedAgentName || "",
        notificationNumberIds: Array.isArray((data as any).notificationNumberIds)
          ? (data as any).notificationNumberIds
          : [],
        price: (data as any).price || "",
        m2: (data as any).m2 || "",
        rooms: (data as any).rooms || "",
        address: (data as any).address || "",
        street: (data as any).street || "",
        city: (data as any).city || "",
        province: (data as any).province || "",
        postalCode: (data as any).postalCode || "",
        country: (data as any).country || "",
        provinceNormalized: (data as any).provinceNormalized || "",
        agentName: (data as any).agentName || "",
        minMonthlyIncome: (data as any).minMonthlyIncome ?? null,
        maxPeople: (data as any).maxPeople ?? null,
        requireMortgageApproved: (data as any).requireMortgageApproved === true,
        captacionId: (data as any).captacionId || "",
        profitabilityReportAvailable: data.profitabilityReportAvailable,
        profitabilityReport: data.profitabilityReport,
        isActive: true, // Nuevo anuncio siempre empieza como activo
        createdAt: now,
        updatedAt: now,
      }),
      120000, // 2 minutes timeout
      "createListing"
    );
    console.log("Listing created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating listing:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.name, error.message);
    }
    throw error;
  }
}

export async function updateListing(id: string, data: Partial<ListingFormData>): Promise<void> {
  const docRef = doc(db, getListingsCollection(), id);
  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (data.description !== undefined) updateData.description = data.description;
  if (data.listingCode !== undefined) updateData.listingCode = data.listingCode;
  if ((data as any).listingCodeFotocasa !== undefined) updateData.listingCodeFotocasa = (data as any).listingCodeFotocasa;
  if ((data as any).referencia !== undefined) updateData.referencia = (data as any).referencia;
  if (data.link !== undefined) updateData.link = data.link;
  if (data.operationType !== undefined) updateData.operationType = data.operationType;
  if (data.features !== undefined) updateData.features = data.features;
  if ((data as any).idealistaDescription !== undefined) updateData.idealistaDescription = (data as any).idealistaDescription;
  if ((data as any).rentalSubtype !== undefined) updateData.rentalSubtype = (data as any).rentalSubtype;
  if ((data as any).quickQualificationEnabled !== undefined) updateData.quickQualificationEnabled = (data as any).quickQualificationEnabled === true;
  if ((data as any).price !== undefined) updateData.price = (data as any).price;
  if ((data as any).m2 !== undefined) updateData.m2 = (data as any).m2;
  if ((data as any).rooms !== undefined) updateData.rooms = (data as any).rooms;
  if ((data as any).address !== undefined) updateData.address = (data as any).address;
  if ((data as any).street !== undefined) updateData.street = (data as any).street;
  if ((data as any).city !== undefined) updateData.city = (data as any).city;
  if ((data as any).province !== undefined) updateData.province = (data as any).province;
  if ((data as any).postalCode !== undefined) updateData.postalCode = (data as any).postalCode;
  if ((data as any).country !== undefined) updateData.country = (data as any).country;
  if ((data as any).provinceNormalized !== undefined) updateData.provinceNormalized = (data as any).provinceNormalized;
  if ((data as any).agentName !== undefined) updateData.agentName = (data as any).agentName;
  if ((data as any).assignedAgentUid !== undefined) updateData.assignedAgentUid = (data as any).assignedAgentUid;
  if ((data as any).assignedAgentName !== undefined) updateData.assignedAgentName = (data as any).assignedAgentName;
  if (Array.isArray((data as any).notificationNumberIds)) {
    updateData.notificationNumberIds = (data as any).notificationNumberIds;
  }
  if ((data as any).minMonthlyIncome !== undefined) updateData.minMonthlyIncome = (data as any).minMonthlyIncome;
  if ((data as any).maxPeople !== undefined) updateData.maxPeople = (data as any).maxPeople;
  if ((data as any).requireMortgageApproved !== undefined) updateData.requireMortgageApproved = (data as any).requireMortgageApproved === true;
  if ((data as any).captacionId !== undefined) updateData.captacionId = (data as any).captacionId;
  if (data.profitabilityReportAvailable !== undefined) updateData.profitabilityReportAvailable = data.profitabilityReportAvailable;
  if (data.profitabilityReport !== undefined) updateData.profitabilityReport = data.profitabilityReport;

  await updateDoc(docRef, updateData);
}

export async function deleteListing(id: string): Promise<void> {
  const docRef = doc(db, getListingsCollection(), id);
  await deleteDoc(docRef);
}

// Desactivar un anuncio con razón de cierre
export async function deactivateListing(
  id: string,
  reason: ListingClosureReason,
  qualifiedLeadId?: string,
  qualifiedLeadName?: string,
  notes?: string
): Promise<void> {
  const docRef = doc(db, getListingsCollection(), id);
  const closureInfo: ListingClosureInfo = {
    reason,
    closedAt: Timestamp.now(),
  };

  if (qualifiedLeadId) closureInfo.qualifiedLeadId = qualifiedLeadId;
  if (qualifiedLeadName) closureInfo.qualifiedLeadName = qualifiedLeadName;
  if (notes) closureInfo.notes = notes;

  await updateDoc(docRef, {
    isActive: false,
    closureInfo,
    updatedAt: Timestamp.now(),
  });
}

// Reactivar un anuncio
export async function reactivateListing(id: string): Promise<void> {
  const docRef = doc(db, getListingsCollection(), id);
  await updateDoc(docRef, {
    isActive: true,
    closureInfo: null, // Eliminar info de cierre
    updatedAt: Timestamp.now(),
  });
}

// Obtener solo anuncios activos
export async function getActiveListings(): Promise<Listing[]> {
  const listings = await getListings();
  return listings.filter(l => l.isActive !== false); // compatibilidad con listings sin el campo
}

// Obtener solo anuncios inactivos (cerrados)
export async function getClosedListings(): Promise<Listing[]> {
  const listings = await getListings();
  return listings.filter(l => l.isActive === false);
}

// Obtener estadísticas de conversión
export async function getConversionStats(): Promise<{
  totalClosed: number;
  soldToQualified: number;
  rentedToQualified: number;
  soldToOther: number;
  rentedToOther: number;
  other: number;
}> {
  const closedListings = await getClosedListings();

  return {
    totalClosed: closedListings.length,
    soldToQualified: closedListings.filter(l => l.closureInfo?.reason === "sold_to_qualified").length,
    rentedToQualified: closedListings.filter(l => l.closureInfo?.reason === "rented_to_qualified").length,
    soldToOther: closedListings.filter(l => l.closureInfo?.reason === "sold_to_other").length,
    rentedToOther: closedListings.filter(l => l.closureInfo?.reason === "rented_to_other").length,
    other: closedListings.filter(l => l.closureInfo?.reason === "other").length,
  };
}

// La funcionalidad de generación automática ha sido desactivada a petición del usuario
// para favorecer la introducción manual de datos debido a los bloqueos de Idealista.
