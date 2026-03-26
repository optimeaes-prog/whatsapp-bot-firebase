import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Configuration
const PROJECT_ID = "real-estate-idealista-bot";
const DATABASE_ID = "realestate-whatsapp-bot";
// This needs to be set in your environment
const VAPI_API_KEY = process.env.VAPI_API_KEY;

if (!VAPI_API_KEY) {
    console.error("❌ Error: No se encontró la variable de entorno VAPI_API_KEY.");
    process.exit(1);
}

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: PROJECT_ID
    });
}

const db = getFirestore(admin.app(), DATABASE_ID);
db.settings({ ignoreUndefinedProperties: true });

/**
 * Robustly extracts details from a VAPI call object, handling different response structures
 */
function extractVapiCallDetails(vCall) {
    const analysis = vCall.analysis || {};
    const artifact = vCall.artifact || {};

    // 1. Extract Transcript
    const transcript = vCall.transcript || analysis.transcript || artifact.transcript;

    // 2. Extract Structured Data
    let sd = analysis.structuredData || {};

    // If we have structuredOutputs (often in API response), merge them
    const structuredOutputs = artifact.structuredOutputs;
    if (structuredOutputs && typeof structuredOutputs === 'object') {
        for (const key in structuredOutputs) {
            const item = structuredOutputs[key];
            if (item && typeof item === 'object' && item.name) {
                sd[item.name] = item.result;
            }
        }
    }

    // 3. Extract Summary
    let summary = vCall.summary || analysis.summary || artifact.summary;
    if (!summary && sd.notes) {
        summary = sd.notes;
    }

    // 4. Metadata
    const isQualified = sd.is_qualified === true;
    const customerName = sd.name || vCall.customer?.name;
    const listingCode = vCall.assistantOverrides?.variableValues?.LISTING_CODE || sd.listing_code;

    return { transcript, summary, sd, isQualified, customerName, listingCode };
}

async function syncCalls() {
    console.log("--- Iniciando sincronización de llamadas desde VAPI ---");

    try {
        // 1. Obtener llamadas de VAPI
        console.log("Obteniendo llamadas de la API de VAPI...");
        const response = await fetch("https://api.vapi.ai/call?limit=100", {
            headers: {
                "Authorization": `Bearer ${VAPI_API_KEY}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Error en la API de VAPI (${response.status}):`, errorText);
            return;
        }

        const vapiCalls = await response.json();
        if (!Array.isArray(vapiCalls)) {
            console.error("❌ Error: La respuesta de VAPI no es un array:", vapiCalls);
            return;
        }

        console.log(`Se encontraron ${vapiCalls.length} llamadas en VAPI. Procesando...`);

        let syncedCount = 0;
        let updatedCount = 0;

        for (const vCall of vapiCalls) {
            const callId = vCall.id;
            const { transcript, summary, sd, isQualified, customerName, listingCode } = extractVapiCallDetails(vCall);

            const phone = vCall.customer?.number;
            if (!phone) continue;

            const callData = {
                phone,
                chatId: phone.replace("+", "").replace(/\s/g, "") + "@s.whatsapp.net",
                name: customerName || null,
                listingCode: listingCode || null,
                transcript: transcript || null,
                summary: summary || null,
                isQualified,
                recordingUrl: vCall.recordingUrl || vCall.artifact?.recordingUrl || null,
                timestamp: vCall.createdAt ? admin.firestore.Timestamp.fromDate(new Date(vCall.createdAt)) : admin.firestore.FieldValue.serverTimestamp(),
                callId,
                structuredData: sd,
            };

            // Remove undefined or null if preferred, but ignoreUndefinedProperties handles it

            const snapshot = await db.collection("calls").where("callId", "==", callId).get();

            if (!snapshot.empty) {
                const docId = snapshot.docs[0].id;
                await db.collection("calls").doc(docId).update(callData);
                console.log(`✅ [Actualizada] ${callId} (${customerName || phone})`);
                updatedCount++;
            } else {
                await db.collection("calls").add(callData);
                console.log(`🆕 [Creada] ${callId} (${customerName || phone})`);
                syncedCount++;
            }
        }

        console.log(`\n--- Sincronización finalizada ---`);
        console.log(`Nuevas: ${syncedCount}`);
        console.log(`Actualizadas: ${updatedCount}`);

    } catch (error) {
        console.error("❌ Error durante la sincronización:", error.message);
    } finally {
        process.exit();
    }
}

syncCalls();
