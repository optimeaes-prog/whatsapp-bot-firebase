import { defineSecret, defineString } from "firebase-functions/params";

/**
 * HMAC secret for the signed links to the public "leads sin respuesta" page
 * (set in Secret Manager). Kept separate from EMAIL_UNSUBSCRIBE_SECRET so a
 * leak of one link-signing key can't be used to mint the other kind of link.
 */
export const INACTIVE_LEADS_SECRET = defineSecret("INACTIVE_LEADS_SECRET");

/**
 * Ensayo del aviso diario. En "true" el job hace todo el trabajo (buscar leads,
 * resolver destinatarios, montar el mensaje) y lo escribe en el log **sin
 * enviar nada y sin marcar ningún lead como avisado**. Arranca encendido a
 * propósito: nadie recibe un WhatsApp hasta que se apague queriendo.
 */
export const INACTIVITY_ALERT_DRY_RUN = defineString("INACTIVITY_ALERT_DRY_RUN", { default: "true" });

/**
 * Si lleva un orgId, el aviso solo se manda a esa organización y el resto ni se
 * miran. Sirve para el primer envío de verdad: se prueba con una agencia (o con
 * una de pruebas que tenga tu propio número) sin escribir a todas las demás.
 * Vacío = todas.
 */
export const INACTIVITY_ALERT_ONLY_ORG = defineString("INACTIVITY_ALERT_ONLY_ORG", { default: "" });

/**
 * ANDAMIO TEMPORAL — quitar cuando el aviso esté rodado en producción.
 *
 * Número al que desviar el aviso para probarlo de verdad sin escribir a la
 * agencia. Solo se respeta si además hay INACTIVITY_ALERT_ONLY_ORG: así, aunque
 * alguien se lo deje puesto, nunca puede secuestrar los avisos de todas las
 * agencias a la vez. Con el desvío puesto el envío es real pero **no se marca
 * ningún lead**, para que el primer aviso de verdad los incluya todos.
 */
export const INACTIVITY_ALERT_TEST_NUMBER = defineString("INACTIVITY_ALERT_TEST_NUMBER", {
  default: "",
});

/** Plantilla de Twilio por defecto para el aviso (cada org puede sobrescribirla). */
export const TWILIO_TEMPLATE_SID_INACTIVE_LEADS = defineString("TWILIO_TEMPLATE_SID_INACTIVE_LEADS", {
  default: "",
});
