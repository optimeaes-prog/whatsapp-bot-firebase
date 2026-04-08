import axios from "axios";
import { VAPI_API_KEY } from "../secrets";

/**
 * Retrieves historical calls from VAPI.
 */
export async function listCalls(limit: number = 50) {
    const apiKey = VAPI_API_KEY.value();
    if (!apiKey) {
        throw new Error("VAPI API Key missing");
    }

    try {
        const response = await axios.get(
            `https://api.vapi.ai/call?limit=${limit}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            }
        );

        return response.data;
    } catch (error: any) {
        console.error("Error fetching VAPI calls:", error.response?.data || error.message);
        throw new Error(`VAPI List Calls Failed: ${error.response?.data?.message || error.message}`);
    }
}

/*
 * ==================== VAPI (dashboard / createVapiAssistant.mjs) ====================
 *
 * Inbound assistant: obtener listing code del anuncio. El teléfono es call.customer.number.
 * No se pide nombre ni teléfono al usuario.
 *
 * Flujo conversacional: saludo → provincia → alquiler/venta → precio → habitaciones →
 * find_listing(province, operationType, price, rooms). Desambiguación con listingCode
 * o candidateListingCodes + street. Doble confirmación (anuncio + WhatsApp) y cierre
 * con frase que dispara endCallPhrases.
 *
 * Structured data (analysis): solo listing_code (refuerzo). El backend prioriza el
 * último tool find_listing con found=true en messages (extractListingCodeFromMessages).
 *
 * Tool find_listing → Cloud Function vapiApiHandler.
 * Webhook end-of-call → vapiWebhook (mismo pipeline de alta que newLead / leadOnboarding).
 */
