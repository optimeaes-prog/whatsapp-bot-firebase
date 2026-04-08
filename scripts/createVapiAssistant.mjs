#!/usr/bin/env node

/**
 * Script para crear un asistente VAPI optimizado para llamadas inmobiliarias multilingües (ES/EN)
 *
 * Uso:
 *   node scripts/createVapiAssistant.mjs
 *   (Lee variables de .env.vapi o de process.env)
 *
 * Para actualizar un asistente existente:
 *   ASSISTANT_ID=asst_xxx node scripts/createVapiAssistant.mjs
 *
 * La VAPI_API_KEY es la PRIVATE KEY del dashboard de VAPI (empieza con "sk-" o similar).
 * La puedes encontrar en: https://dashboard.vapi.ai/ → API Keys → Private Key
 *
 * Para producción, guarda la VAPI_API_KEY en Google Secret Manager:
 *   firebase functions:secrets:set VAPI_API_KEY
 *   (pega el valor cuando te lo pida)
 */

import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env.vapi si existe
const envPath = join(__dirname, '..', '.env.vapi');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✅ Variables cargadas desde .env.vapi\n');
}

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID; // Opcional: para actualizar uno existente
const VAPI_TOOL_SERVER_URL = process.env.VAPI_TOOL_SERVER_URL || 'https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/vapiApiHandler';
const VAPI_WEBHOOK_URL = process.env.VAPI_WEBHOOK_URL || 'https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/vapiWebhook';

if (!VAPI_API_KEY) {
  console.error('❌ Error: VAPI_API_KEY no encontrada.');
  console.error('');
  console.error('Pasos para obtenerla:');
  console.error('  1. Ve a https://dashboard.vapi.ai/ → API Keys');
  console.error('  2. Copia la PRIVATE Key (no la Public Key)');
  console.error('  3. Pégala en el archivo .env.vapi:');
  console.error('     VAPI_API_KEY=tu_private_key_aqui');
  process.exit(1);
}

// ===== SYSTEM PROMPT =====
// Objetivo: listing code confirmado. Teléfono = caller (no preguntar). Sin nombre.
// Hard stop: maxDurationSeconds.

const SYSTEM_PROMPT = `Eres el asistente telefónico de una agencia inmobiliaria en España.

OBJETIVO: Identificar el anuncio por el que llama el interesado. El teléfono ya lo tenemos del número desde el que llama. NO pidas nombre, teléfono ni otros datos personales.

IDIOMA: Español formal (usted). Solo inglés si el cliente habla claramente en inglés.

FLUJO — Una sola pregunta por turno. NO llames a find_listing hasta haber completado los pasos 2 a 5 (respuesta del cliente cada vez).

1. SALUDO breve:
   "Buenas [tardes/días], agencia inmobiliaria, ¿en qué le puedo ayudar?"

2. PROVINCIA — Pregunta en qué provincia está la vivienda. Espera la respuesta.

3. TIPO DE OPERACIÓN — "¿Es alquiler o venta?" Debe quedar exactamente "Alquiler" o "Venta".

4. PRECIO — Si alquiler: mensualidad en euros. Si venta: precio total en euros. Número claro.

5. HABITACIONES — Número de habitaciones.

6. PRIMERA BÚSQUEDA — Llama UNA vez a find_listing con: province, operationType, price, rooms (números como número, no texto largo).

7. VARIAS OPCIONES — Si la herramienta devuelve multipleOptions:
   a) Lee cada opción con addressForSpeech, habitaciones y spokenPrice.
   b) Cuando el cliente elija una, llama find_listing de nuevo pasando SOLO el listingCode de esa opción (viene en cada opción).
   c) Opcional: si necesitas acotar dentro de la misma lista, puedes pasar candidateListingCodes (array con todos los listingCode de la lista anterior) y street u otros filtros; el backend reducirá candidatos.

8. CONFIRMACIÓN DEL ANUNCIO (primera) — Con found=true:
   - Dirección: SOLO addressForSpeech (no leas códigos postales dígito a dígito).
   - Habitaciones en palabras si ayuda.
   - Precio: SOLO spokenPrice, literal.
   Pregunta: "¿Es este el anuncio por el que llama?"

9. CONFIRMACIÓN WHATSAPP (segunda) — Si confirma el anuncio: "¿Confirma que desea que le contactemos por WhatsApp para este anuncio?" Solo si responde afirmativamente, pasa al cierre.

10. CIERRE — Usa el agentName del último find_listing con found=true (campo agentName; si no viniera, di "el agente"):
   ES: "Perfecto. El asistente de [agentName] le enviará un mensaje de WhatsApp en breve. ¡Que tenga un buen día!"
   EN: "Perfect. [agentName]'s assistant will send you a WhatsApp message shortly. Have a great day!"

La llamada cuelga al detectar "buen día" / "great day". NO uses herramientas para colgar.

REGLAS:
- Tono profesional y breve (máx. ~15 s de audio por turno).
- NO cualifiques al lead (ingresos, mascotas, etc.).
- NO inventes precios: solo spokenPrice del tool.
- Si a los 2,5 minutos no hay doble confirmación, disculpa y cierra con la frase completa que incluya "buen día".
- Si el cliente divaga, redirige: "Para localizar el anuncio, ¿en qué provincia está la vivienda?"`;

// ===== CONFIGURACIÓN DEL ASISTENTE =====

const assistantConfig = {
  name: "Asistente Inmobiliario Inbound",

  transcriber: {
    provider: "deepgram",
    model: "nova-3",
    language: "es",
    numerals: true,
  },

  voice: {
    provider: "11labs",
    model: "eleven_multilingual_v2",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    fallbackPlan: {
      voices: [
        { provider: "azure", voiceId: "es-ES-ElviraNeural" },
        { provider: "azure", voiceId: "en-US-AriaNeural" }
      ]
    }
  },

  model: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.3,
    maxTokens: 280,
    messages: [
      { role: "system", content: SYSTEM_PROMPT }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "find_listing",
          description:
            "Busca un anuncio activo. Si el cliente elige entre varias opciones, pasa listingCode. Si acotas dentro de una lista previa, usa candidateListingCodes más street opcional. Primera búsqueda: province + operationType + price + rooms.",
          parameters: {
            type: "object",
            properties: {
              listingCode: {
                type: "string",
                description: "Código del anuncio (tras elegir entre opciones o si el cliente lo dicta)",
              },
              province: {
                type: "string",
                description: "Provincia de la vivienda (primera búsqueda)",
              },
              operationType: {
                type: "string",
                enum: ["Alquiler", "Venta"],
                description: "Tipo de operación",
              },
              price: {
                type: "number",
                description: "Precio en euros: mensual si alquiler, total si venta",
              },
              rooms: {
                type: "number",
                description: "Número de habitaciones",
              },
              street: {
                type: "string",
                description: "Calle o zona para acotar (opcional)",
              },
              m2: {
                type: "number",
                description: "Metros cuadrados aproximados (opcional)",
              },
              candidateListingCodes: {
                type: "array",
                items: { type: "string" },
                description: "Lista de códigos devueltos en una búsqueda anterior; restringe la segunda pasada",
              },
            },
          },
        },
        server: {
          url: VAPI_TOOL_SERVER_URL,
          timeoutSeconds: 15
        }
      }
    ]
  },
  endCallFunctionEnabled: false,

  endCallPhrases: [
    "buen día",
    "buena tarde",
    "buenas tardes",
    "great day",
    "have a good day",
  ],

  firstMessage:
    "Buenas, somos el asistente virtual de la agencia inmobiliaria. Un momento… ¿en qué podemos ayudarle?",
  firstMessageMode: "assistant-speaks-first",

  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: "object",
        properties: {
          listing_code: {
            type: "string",
            description: "Código de referencia del anuncio confirmado (Idealista)",
          },
        },
        required: ["listing_code"],
      },
    },
  },

  serverMessages: ["end-of-call-report", "function-call"],
  serverUrl: VAPI_WEBHOOK_URL,

  silenceTimeoutSeconds: 20,
  maxDurationSeconds: 240,

  startSpeakingPlan: {
    waitSeconds: 1.35,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: 0.35,
      onNoPunctuationSeconds: 2.6
    }
  },

  stopSpeakingPlan: {
    numWords: 3,
    voiceSeconds: 0.35,
    backoffSeconds: 1.3
  },

  backgroundSound: "off",
};

// ===== HTTP CLIENT =====

function makeVapiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vapi.ai',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ===== MAIN =====

async function run() {
  console.log('🚀 Configurando asistente VAPI...\n');
  console.log('📋 Configuración:');
  console.log(`   Transcriber : Deepgram Nova 3 (es)`);
  console.log(`   Voice       : ElevenLabs + Azure fallback`);
  console.log(`   Model       : GPT-4o (temp 0.3)`);
  console.log(`   Hard stop   : 4 minutos (240 s)`);
  console.log(`   Tool URL    : ${VAPI_TOOL_SERVER_URL}`);
  console.log(`   Webhook URL : ${VAPI_WEBHOOK_URL}`);
  console.log('');

  let result;
  if (ASSISTANT_ID) {
    console.log(`📝 Actualizando asistente existente: ${ASSISTANT_ID}`);
    result = await makeVapiRequest('PATCH', `/assistant/${ASSISTANT_ID}`, assistantConfig);
  } else {
    console.log('✨ Creando nuevo asistente...');
    result = await makeVapiRequest('POST', '/assistant', assistantConfig);
  }

  console.log('\n✅ Asistente guardado correctamente');
  console.log(`   ID: ${result.id}`);
  console.log(`   Dashboard: https://dashboard.vapi.ai/assistants/${result.id}`);
  if (!ASSISTANT_ID) {
    console.log('\n💾 Guarda este ID en .env.vapi para futuras actualizaciones:');
    console.log(`   ASSISTANT_ID=${result.id}`);
  }
}

run().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
