import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { BotConfig, BotStyle, MessagingProvider } from "../types";

import { getOrganizationBasePath } from "../lib/organization";

const CONFIG_DOC_ID = "config";
function getBotConfigCollection() {
  return `${getOrganizationBasePath()}/botConfig`;
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
  const docRef = doc(db, getBotConfigCollection(), CONFIG_DOC_ID);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
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
  const docRef = doc(db, getBotConfigCollection(), CONFIG_DOC_ID);
  await setDoc(docRef, { activeStyleId: styleId }, { merge: true });
}

export async function updateMessagingProvider(provider: MessagingProvider): Promise<void> {
  const docRef = doc(db, getBotConfigCollection(), CONFIG_DOC_ID);
  await setDoc(docRef, { messagingProvider: provider }, { merge: true });
}

export async function updateOrgName(orgName: string): Promise<void> {
  const docRef = doc(db, getBotConfigCollection(), CONFIG_DOC_ID);
  await setDoc(docRef, { orgName }, { merge: true });
}

export async function getActiveStyle(): Promise<BotStyle> {
  const config = await getBotConfig();
  const activeStyle = config.styles.find((s) => s.id === config.activeStyleId);
  return activeStyle || DEFAULT_STYLES[0];
}
