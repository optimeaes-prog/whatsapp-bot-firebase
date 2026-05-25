# Data Processing Inventory — Talmate Limited (Proplead)

**Version:** 1.0  
**Last updated:** 25 May 2026  
**Confidential — internal use only**

> **Key roles:** Talmate operates as a **B2B SaaS** provider. In the typical setup:
> - **Customer (freelancer/agency/immobiliaria)** = **Controller** of lead/contact data they collect via Proplead.
> - **Talmate** = **Processor** for WhatsApp/voice conversations and lead qualification run on behalf of the customer; **Controller** for its own account, billing, and marketing data.

---

## 1. Entity and product overview

| Field | Detail |
|---|---|
| Legal entity | Talmate Limited |
| Companies House | 16733027 |
| Registered address | 191 King's Cross Road, Flat 2, London, WC1X 9DB, UK |
| Privacy contact | soporte@proplead.io |
| Platform name | Proplead |
| Primary market | Spain (EEA) |
| Legal frameworks | UK GDPR · EU GDPR (Art. 3.2 — data of EEA residents) · UK DPA 2018 · LSSI-CE (Spain) |
| Supervisory authorities | ICO (UK) · AEPD (Spain/EU) |

**Product:** React web app + Firebase Functions backend providing WhatsApp/voice conversation management, AI-powered lead qualification, CRM, alerts and billing for real estate agencies in Spain. Firebase Functions run in region `europe-west1`.

---

## 2. Data categories

### A — Customer accounts & admin users (Talmate as **Controller**)

| Element | Detail |
|---|---|
| Data | Email, UID, name (if provided), authentication metadata (Firebase Auth), login timestamps, session data |
| Source | Directly from the customer user at registration/login |
| Purposes | Account access, authentication, security, support, abuse prevention |
| Legal bases | Art. 6(1)(b) GDPR — contract performance; Art. 6(1)(f) — legitimate interests (security) |
| Retention | Duration of account + 2 years post-deletion (potential claims window) |
| Sub-processors | Google/Firebase |

### B — Billing and payments (Talmate as **Controller**)

| Element | Detail |
|---|---|
| Data | Stripe customer ID, subscription ID, payment method ID (tokenised), checkout/session metadata, credit balance, payment history |
| Source | Directly from customer; processed via Stripe |
| Purposes | Payment processing, invoicing, credit management, subscription renewals, fraud/abuse prevention |
| Legal bases | Art. 6(1)(b) — contract; Art. 6(1)(c) — legal obligation (accounting); Art. 6(1)(f) — legitimate interests (fraud) |
| Retention | 7 years from last transaction (tax/accounting obligations) |
| Sub-processors | Stripe Inc. |

### C — Support and communications (Talmate as **Controller**)

| Element | Detail |
|---|---|
| Data | Support messages, tickets, diagnostic logs, email/chat records |
| Source | Directly from customer users |
| Purposes | Provide support, service communications, dispute resolution |
| Legal bases | Art. 6(1)(b) — contract; Art. 6(1)(f) — legitimate interests |
| Retention | 3 years from resolution |
| Sub-processors | Google/Firebase (logs) |

### D — Marketing communications (Talmate as **Controller**)

| Element | Detail |
|---|---|
| Data | Email address, marketing preferences, engagement metrics |
| Source | Customers who opt in; B2B legitimate interests (existing customers) |
| Purposes | Product marketing, feature updates, promotions |
| Legal bases | Art. 6(1)(f) — legitimate interests (existing B2B customers, with opt-out); Art. 6(1)(a) — consent where required |
| Retention | Until opt-out / withdrawal of consent + 1 year |
| Sub-processors | Email provider (TBD) |

### E — Website/app analytics and advertising (Talmate as **Controller**)

| Category | Vendors | Purposes | Legal basis | Requires consent |
|---|---|---|---|---|
| Essential / session | Firebase Auth, Firebase SDK | Authentication, session management, security, fraud prevention | Art. 6(1)(b)/(f) — contract/legitimate interests | No |
| Analytics | Google Analytics 4 (GA4) via Google Tag Manager | Measure usage, understand user behaviour, improve product | Art. 6(1)(a) — consent | **Yes** |
| Advertising | Meta Pixel (Meta Platforms Ireland Ltd) | Ad conversion measurement, retargeting, custom audiences on Facebook/Instagram | Art. 6(1)(a) — consent | **Yes** |
| Advertising | Google Ads / Google Tag (Google LLC) | Ad conversion measurement, remarketing on Google Ads | Art. 6(1)(a) — consent | **Yes** |

Analytics and advertising cookies must be withheld until the user actively consents via a compliant cookie banner (equal prominence for accept/reject — AEPD 2023 guidance).

### F — Leads & conversations (Customer as **Controller**; Talmate as **Processor**)

Data processed within Proplead to run the customer's AI bot and manage leads:

| Element | Detail |
|---|---|
| Identifiers | Phone number (E.164), chatId, call IDs, message timestamps |
| Conversation content | Inbound/outbound message text, conversation history, bot state, language, tags, status flags |
| Lead profile | Name, household composition, budget (numeric), property type sought, preferred location/area, visit availability, pets, payment method (cash/mortgage), notes, qualification score/status |
| Listings | Listing codes, links, address, property features |
| Purposes (as Processor) | Run customer's bot flows, AI qualification, manual messaging by agents, lead analytics/summaries for agents |
| Legal bases | Per customer's instructions and their own legal basis (typically contract/legitimate interests for qualifying inbound leads) |
| Retention | Per DPA: until customer deletes or end of subscription + 30-day recovery window, then deletion |
| Sub-processors | Google/Firebase, Twilio, OpenAI |

**Note on AI (OpenAI):** Conversation history and lead attributes are sent to OpenAI to generate responses and lead summaries. Integration uses `store: false` in OpenAI API calls. OpenAI must be covered as sub-processor in the DPA. Customers must be informed (via lead notice template) that automated AI tools assist in responses.

### G — Voice/calls (Customer as **Controller**; Talmate as **Processor**)

| Element | Detail |
|---|---|
| Data | Caller phone number, Call SID, timestamps, call status, recording URLs (when enabled) |
| Purposes | Call handling, voicemail-to-WhatsApp handoff, operational records |
| Recordings | Stored as URLs in lead/conversation model; customers are responsible for informing callers and obtaining necessary consents |
| Sub-processors | Twilio Inc., Vapi AI Inc. (when enabled) |

---

## 3. International data transfers

| Transfer route | Mechanism |
|---|---|
| EU (Spain) → UK (Talmate) | EU Commission Adequacy Decision for UK (verify current status; fallback: EU SCCs Module 3 Controller→Processor or Module 2 if applicable) |
| UK (Talmate) → US (Google/Firebase, OpenAI, Stripe, Calendly, Vapi) | UK IDTA / UK Addendum to EU SCCs |
| EU → US (via Talmate as Processor) | EU SCCs 2021 (Module 2 or 3 depending on role in each transfer) + supplementary measures |

**Note:** The EU-UK Adequacy Decision (adopted June 2021) should be verified for current validity status. If expired/lapsed, EU SCCs apply for EU→UK transfers.

---

## 4. Sub-processors summary

| Sub-processor | Role | Data categories | Country |
|---|---|---|---|
| Google LLC / Firebase | Infrastructure (Auth, Firestore, Functions, Tasks, Hosting, Logging) | All platform data (A, B, C, E, F, G) | USA |
| Twilio Inc. | WhatsApp messaging + Voice | F (phone, messages), G (calls, recordings) | USA |
| OpenAI OpCo LLC | AI generation & lead summarisation | F (conversation history, lead attributes) | USA |
| Stripe Inc. | Payments & subscriptions | B (billing data) | USA |
| Calendly LLC | Onboarding scheduling | Contact/event data from scheduling | USA |
| Vapi AI Inc. | Voice automation (if enabled) | G (call metadata, transcripts/recordings) | USA |
| Meta Platforms Ireland Ltd | Meta Pixel (ads) | E (website visitor data, conversions) | Ireland / USA |

Full sub-processor details: see `legal/subprocessors.md`.

---

## 5. Retention schedule

| Data category | Retention period | Basis |
|---|---|---|
| Account data | Duration of account + 2 years | Potential claims |
| Billing/payment records | 7 years from last transaction | Tax/accounting obligations |
| Support communications | 3 years from resolution | Limitation period |
| Security/audit logs | 90 days rolling | Operational security |
| Marketing data | Until opt-out + 1 year | Legitimate interests / consent |
| Analytics data (GA4) | 14 months (GA4 default, configurable) | Consent-based |
| Leads/conversations (as Processor) | Per DPA: subscription term + 30-day recovery, then deletion | DPA / customer instructions |
| Call recordings | Per DPA: typically 90 days unless customer instructs otherwise | DPA / regulatory requirements |

---

## 6. EU Representative (Art. 27 RGPD)

Talmate processes personal data of individuals in Spain (EEA) on a non-occasional basis, which triggers consideration of Art. 27 RGPD obligations (appointment of an EU representative). **Action required:** legal counsel to assess and appoint EU representative if required.

---

## 7. Legal documents supported by this inventory

| Document | Path |
|---|---|
| Terms & Conditions (ES) | `legal/terms.es.md` |
| Terms & Conditions (EN) | `legal/terms.en.md` |
| Privacy Policy (ES) | `legal/privacy-policy.es.md` |
| Privacy Policy (EN) | `legal/privacy-policy.en.md` |
| DPA / Acuerdo de Encargo (ES) | `legal/dpa.es.md` |
| DPA (EN) | `legal/dpa.en.md` |
| Cookies Policy (ES) | `legal/cookies.es.md` |
| Cookies Policy (EN) | `legal/cookies.en.md` |
| Sub-processors list | `legal/subprocessors.md` |
| Acceptable Use Policy (ES) | `legal/aup.es.md` |
| Acceptable Use Policy (EN) | `legal/aup.en.md` |
| Lead notice template (ES) | `legal/lead-notice-template.es.md` |
| Call recording notice | `legal/call-recording-notice.es.md` |

---

## 8. Review schedule

This inventory should be reviewed:
- At least annually (next review: May 2027)
- When a new sub-processor is added
- When a new significant processing activity is introduced
- Following any regulatory guidance change from ICO or AEPD
