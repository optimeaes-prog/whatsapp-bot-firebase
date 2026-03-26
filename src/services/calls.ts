import {
    collection,
    doc,
    getDocs,
    getDoc,
    deleteDoc,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Call } from "../types";

import { getOrganizationBasePath } from "../lib/organization";

const COLLECTION_NAME = `${getOrganizationBasePath()}/calls`;

export async function getCalls(): Promise<Call[]> {
    const q = query(
        collection(db, COLLECTION_NAME),
        orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Call[];
}

export async function getCallById(id: string): Promise<Call | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
        return null;
    }
    return { id: snapshot.id, ...snapshot.data() } as Call;
}

export async function deleteCall(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
}
