# Sub-processors / Subencargados — Talmate Limited (Proplead)

**Last updated / Última actualización:** 25 May 2026 / 25 de mayo de 2026  
**Version / Versión:** 1.0  

This is the definitive list of sub-processors used by Talmate Limited ("Talmate") in its capacity as **Data Processor** when processing personal data on behalf of Proplead customers (Data Controllers). This list is incorporated by reference into the Data Processing Agreement (DPA) available at `legal/dpa.en.md` / `legal/dpa.es.md`.

Esta es la lista definitiva de subencargados utilizados por Talmate Limited ("Talmate") en su condición de **Encargado del Tratamiento** cuando trata datos personales por cuenta de los clientes de Proplead (Responsables del Tratamiento). Esta lista se incorpora por referencia al Acuerdo de Encargo del Tratamiento (DPA) disponible en `legal/dpa.es.md`.

Talmate will notify customers of any material changes (additions or replacements) to this list at least 30 days in advance, in accordance with the DPA.  
Talmate notificará a los clientes cualquier cambio material (incorporación o sustitución de subencargados) con al menos 30 días de antelación, conforme al DPA.

---

## Core infrastructure / Infraestructura principal

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **Google LLC** (Firebase / Google Cloud) | Cloud hosting, Firebase Authentication, Firestore database, Cloud Functions, Cloud Tasks, Cloud Logging and monitoring | All platform data: account credentials (Auth), conversation history, lead profiles, call metadata (as stored in Firestore/Functions); security logs | USA | EU SCCs 2021 (Modules 2/3) · UK IDTA | https://policies.google.com/privacy |

**Notes / Notas:**
- Firebase Functions are deployed in the `europe-west1` region (Belgium), minimising data transfers where possible.
- Google Cloud provides AES-256 encryption at rest and TLS 1.2+ in transit.
- Google LLC is a signatory to the EU-US Data Privacy Framework.

---

## Messaging / Mensajería

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **Twilio Inc.** | WhatsApp Business API messaging (inbound and outbound), voice calls, call routing, call recording (when enabled) | Phone numbers, message content, message timestamps, call SIDs, call duration, recording URLs | USA | EU SCCs 2021 (Module 3) · UK IDTA | https://www.twilio.com/en-us/legal/privacy |

**Notes / Notas:**
- Twilio processes WhatsApp messages under a sub-processor agreement with Meta Platforms, Inc. (WhatsApp Business Platform).
- Call recordings are stored by Twilio as URLs; access is controlled by Talmate.

---

## Artificial intelligence / Inteligencia artificial

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **OpenAI OpCo, LLC** | AI language model API for automated lead qualification responses and lead summaries | Conversation history and lead attribute data included in prompts; AI-generated responses and summaries | USA | EU SCCs 2021 (Module 3) · UK IDTA | https://openai.com/policies/privacy-policy |

**Notes / Notas:**
- All API calls use the `store: false` parameter to prevent OpenAI from retaining prompt/response data beyond the immediate API call.
- Data sent to OpenAI is limited to the minimum necessary for the qualification or summary function.
- OpenAI LLC is a signatory to the EU-US Data Privacy Framework.

---

## Payments / Pagos

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **Stripe Inc.** | Payment processing, subscriptions, billing, checkout, credit management | Billing identifiers (customer ID, subscription ID), payment status, tokenised payment method identifier, transaction history | USA | EU SCCs 2021 (Module 2) · UK IDTA | https://stripe.com/privacy |

**Notes / Notas:**
- Stripe processes cardholder data under PCI DSS compliance. Talmate does not store full card numbers.
- Stripe Inc. is a signatory to the EU-US Data Privacy Framework.

---

## Scheduling and onboarding / Agendado y onboarding

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **Calendly LLC** | Meeting scheduling for onboarding and sales demos; webhook event notifications | Invitee name, email, phone (as provided), scheduled event details and timestamps | USA | EU SCCs 2021 (Module 3) · UK IDTA | https://calendly.com/privacy |

**Notes / Notas:**
- Calendly data is limited to onboarding and sales-related events and is not used for lead management.

---

## Optional / Opcional (when enabled / cuando está habilitado)

| Sub-processor | Service / Servicio | Data processed / Datos tratados | Country / País | Transfer mechanism / Mecanismo de transferencia | Privacy policy |
|---|---|---|---|---|---|
| **Vapi AI Inc.** | Voice call automation tooling (when the voice automation module is enabled) | Call metadata, voice transcripts, recordings (depending on configuration) | USA | EU SCCs 2021 (Module 3) · UK IDTA | https://vapi.ai/privacy |

**Notes / Notas:**
- Vapi AI is only active when the voice automation module is explicitly enabled for a customer's account.

---

## Advertising and analytics (Talmate as Controller only)
## Analytics y publicidad (solo cuando Talmate actúa como Responsable)

The following providers are used by Talmate in its capacity as **Data Controller** (not Processor) for its own website analytics and advertising campaigns. They are not sub-processors for customer lead data.

Los siguientes proveedores son utilizados por Talmate en su condición de **Responsable del Tratamiento** (no Encargado) para sus propias analíticas web y campañas publicitarias. No son subencargados de datos de leads de clientes.

| Provider | Service | Data | Country | Transfer mechanism |
|---|---|---|---|---|
| **Google LLC** (Google Analytics 4 + Google Ads) | Website analytics, ad conversion measurement, remarketing | Website visitor behaviour data, conversion events | USA | UK IDTA / EU SCCs |
| **Meta Platforms Ireland Ltd** | Meta Pixel — ad conversion measurement, retargeting on Facebook/Instagram | Website visitor events, conversion data | Ireland / USA | EU SCCs |

---

## Update history / Historial de actualizaciones

| Version | Date | Change |
|---|---|---|
| 1.0 | 25 May 2026 | Initial production version. Replaced v0.1 draft. Confirmed sub-processors: Google/Firebase, Twilio, OpenAI, Stripe, Calendly, Vapi (optional). Added analytics/ads section. |

---

*Talmate Limited — Companies House no. 16733027 — soporte@proplead.io — www.proplead.io*
