import {
    collection,
    query,
    orderBy,
    getDocs,
    deleteDoc,
    doc,
    where,
    Timestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { SystemAlert } from "../types";

import { getOrganizationBasePath } from "../lib/organization";

const ALERTS_COLLECTION = `${getOrganizationBasePath()}/system_alerts`;

export async function getAlerts(): Promise<SystemAlert[]> {
    const alertsRef = collection(db, ALERTS_COLLECTION);

    // Filter by last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

    const q = query(
        alertsRef,
        where("timestamp", ">=", sevenDaysAgoTimestamp),
        orderBy("timestamp", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    })) as SystemAlert[];
}

export async function deleteAlert(id: string): Promise<void> {
    const alertRef = doc(db, ALERTS_COLLECTION, id);
    await deleteDoc(alertRef);
}

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

export async function ignoreChat(chatId: string): Promise<void> {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/ignoreChatForSync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error ignoring chat");
    }
}
