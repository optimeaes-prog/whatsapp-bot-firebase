import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { BotConfig, BotStyle, MessagingProvider } from "../types";

import { getOrganizationBasePath, getOrganizationId } from "../lib/organization";

const CONFIG_DOC_ID = "config";
function getBotConfigDoc() {
  const base = getOrganizationBasePath();
  const orgId = getOrganizationId();
  console.log(`[Diagnostic] Resolving BotConfigDoc: orgId="${orgId}", base="${base}"`);
  return doc(db, `${base}/botConfig`, CONFIG_DOC_ID);
}

// Default assistant styles
export const DEFAULT_STYLES: BotStyle[] = [
  {
    id: "directo",
    name: "Directo y Eficiente",
    description: "Mensajes cortos, sin relleno, agrupa preguntas. Estilo actual del asistente.",
    promptModifier: `- Mensajes CORTOS y DIRECTOS. Máximo 2-3 líneas por mensaje.
- NO repitas información que el usuario acaba de dar.
- NO hagas resúmenes innecesarios ("Entonces, para resumir...").
- NO uses frases de relleno ("¡Gracias por la información!", "Todo parece encajar bien", "Entendido").
- AGRUPA las preguntas relacionadas en UN SOLO mensaje.
- Si el usuario da varios datos, reconócelos brevemente y pregunta SOLO lo que falta.
- Sé amable pero valora el tiempo del usuario.
- VARÍA tu vocabulario de afirmaciones dependiendo del idioma de la conversación (ej. en español usa 'Genial', 'Estupendo', 'Vale', 'De acuerdo'; en inglés usa 'Great', 'Understood', 'Alright'), no repitas siempre lo mismo.`,
  },
  {
    id: "amigable",
    name: "Amigable y Cercano",
    description: "Tono cálido con emojis, más personalizado y conversacional.",
    promptModifier: `- Usa un tono CÁLIDO y CERCANO, como si hablaras con un amigo.
- Incluye emojis ocasionales para dar calidez (😊, 👍, 🏠, ✨) pero sin exceso.
- Haz preguntas de una en una para que la conversación fluya naturalmente.
- Muestra entusiasmo genuino por ayudar al cliente a encontrar su hogar ideal.
- Usa expresiones cercanas acordes al idioma de la conversación (ej. en español "¡Qué bien!", "Me encanta", "¡Genial!"; en inglés "That's great!", "Awesome!").
- Personaliza las respuestas usando el nombre del cliente cuando lo sepas.
- Sé empático si el cliente expresa dudas o preocupaciones.`,
  },
  {
    id: "formal",
    name: "Formal y Profesional",
    description: "Tratamiento de usted, lenguaje corporativo y profesional.",
    promptModifier: `- Usa tratamiento de USTED en todo momento.
- Mantén un tono PROFESIONAL y CORPORATIVO.
- Evita coloquialismos y expresiones informales.
- Usa frases como "Le informo que...", "Permítame indicarle...", "Tendría usted disponibilidad para...".
- Sé cortés pero manteniendo distancia profesional.
- No uses emojis ni expresiones demasiado efusivas.
- Estructura las respuestas de forma clara y ordenada.
- Agradece formalmente según el idioma: "Le agradezco su interés", "Gracias por su tiempo", o "Thank you for your time".`,
  },
  {
    id: "conciso",
    name: "Ultra Conciso",
    description: "Mínimo de palabras, solo información esencial.",
    promptModifier: `- MÁXIMA brevedad. Una línea por mensaje si es posible.
- Solo lo ESENCIAL. Nada de cortesías innecesarias.
- Preguntas directas sin introducción.
- Respuestas tipo telegrama.
- Sin emojis, sin relleno, sin repeticiones.
- Ejemplo: "¿Nombre?" en vez de "¿Con quién tengo el gusto de hablar?"
- Ejemplo: "¿Hipoteca o contado?" en vez de "¿La compra sería al contado o necesitaría financiación mediante hipoteca?"`,
  },
];

export async function getBotConfig(): Promise<BotConfig> {
  const docRef = getBotConfigDoc();
  console.log(`[Diagnostic] Attempting to fetch document from: ${docRef.path}`);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    console.warn(`[Diagnostic] Document NOT FOUND at path: ${docRef.path}. Initializing default.`);
    // Initialize with default config
    const defaultConfig: BotConfig = {
      activeStyleId: "directo",
      styles: DEFAULT_STYLES,
      messagingProvider: "whapi",
      orgName: "Atlas Capital Group",
    };
    await setDoc(docRef, defaultConfig);
    return defaultConfig;
  }

  const data = snapshot.data() as BotConfig;
  // Ensure messagingProvider has a default
  if (!data.messagingProvider) {
    data.messagingProvider = "whapi";
  }
  return data;
}

export async function updateActiveStyle(styleId: string): Promise<void> {
  const docRef = getBotConfigDoc();
  await setDoc(docRef, { activeStyleId: styleId }, { merge: true });
}

export async function updateMessagingProvider(provider: MessagingProvider): Promise<void> {
  const docRef = getBotConfigDoc();
  await setDoc(docRef, { messagingProvider: provider }, { merge: true });
}

export async function updateOrgName(orgName: string): Promise<void> {
  const docRef = getBotConfigDoc();
  await setDoc(docRef, { orgName }, { merge: true });
}

export async function updateNotificationNumbers(numbers: string): Promise<void> {
  const docRef = getBotConfigDoc();
  await setDoc(docRef, { notificationNumbers: numbers }, { merge: true });
}

export async function getActiveStyle(): Promise<BotStyle> {
  const config = await getBotConfig();
  const activeStyle = config.styles.find((s) => s.id === config.activeStyleId);
  return activeStyle || DEFAULT_STYLES[0];
}
