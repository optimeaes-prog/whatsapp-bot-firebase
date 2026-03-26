import axios from "axios";
import { defineString } from "firebase-functions/params";
import { ListingRow } from "../types";

const VAPI_API_KEY = defineString("VAPI_API_KEY");
const VAPI_ASSISTANT_ID = defineString("VAPI_ASSISTANT_ID");
const VAPI_PHONE_NUMBER_ID = defineString("VAPI_PHONE_NUMBER_ID");

/**
 * Triggers an outbound call via VAPI to a lead.
 */
export async function triggerOutboundCall(params: {
    phone: string;
    listing: ListingRow;
    customerName?: string;
}) {
    const apiKey = VAPI_API_KEY.value();
    const assistantId = VAPI_ASSISTANT_ID.value();
    const phoneNumberId = VAPI_PHONE_NUMBER_ID.value();

    if (!apiKey || !assistantId || !phoneNumberId) {
        throw new Error("VAPI configuration missing (API Key, Assistant ID or Phone Number ID)");
    }

    // Prepare the custom instructions for this specific call
    const assistantOverrides = {
        variableValues: {
            LISTING_CODE: params.listing.listingCode,
            CARACTERISTICAS: params.listing.features,
            TIPO_OPERACION: params.listing.operationType,
            ENLACE_LISTING: params.listing.link,
            PRECIO: params.listing.price,
            HABITACIONES: params.listing.rooms,
            UBICACION: params.listing.address,
            METROS_CUADRADOS: params.listing.m2,
            DESCRIPCION_IDEALISTA: params.listing.idealistaDescription,
            // Pass profitability if available
            INFORME_RENTABILIDAD: params.listing.profitabilityReport || "No disponible",
        },
        // We can also override the initial message to be more personal
        firstMessage: params.customerName
            ? `Hola ${params.customerName}, soy el asistente de Paco Granados. Te llamo porque te has interesado en nuestra propiedad en ${params.listing.description}. ¿Te pillo en un buen momento para hablar un par de minutos?`
            : `Hola, soy el asistente de Paco Granados. Te llamo por tu interés en una de nuestras propiedades. ¿Tienes un momento para que te cuente los detalles?`
    };

    try {
        const response = await axios.post(
            "https://api.vapi.ai/call/phone",
            {
                assistantId: assistantId,
                phoneNumberId: phoneNumberId,
                customer: {
                    number: params.phone,
                    name: params.customerName || "Lead"
                },
                assistantOverrides: assistantOverrides
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data;
    } catch (error: any) {
        console.error("Error triggering VAPI call:", error.response?.data || error.message);
        throw new Error(`VAPI Call Failed: ${error.response?.data?.message || error.message}`);
    }
}

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
