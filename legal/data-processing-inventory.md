# Data processing inventory (Talmate Limited)

Version: 0.1 (draft)  
Last updated: 2026-04-01  

This inventory is meant to support the legal documents in this repository (Terms, Privacy Policy, Cookies Policy, DPA, templates).

> Important: Talmate operates as **SaaS B2B**. In the typical setup:
> - **Customer (freelancer/agency)** = **Controller** of lead/contact data.
> - **Talmate** = **Processor** for WhatsApp/voice conversations and lead qualification, **Controller** for account/billing/marketing data.

## 1) Product overview (from codebase)
- Web app (React) to manage inbound/outbound **WhatsApp conversations**, **leads**, **listings**, **alerts**, and **credits/subscriptions**.
- Backend in Firebase Functions (region `europe-west1`) orchestrates:
  - inbound WhatsApp messages (Twilio/Whapi webhooks)
  - buffering and processing via Cloud Tasks
  - AI responses and lead summarization (OpenAI)
  - payments, credits, subscriptions and webhooks (Stripe)
  - onboarding events (Calendly)
  - voice webhook (Twilio) and call handoff to WhatsApp; recordings are contemplated/stored as URLs in lead/conversation models.

Primary implementation references:
- `functions/src/index.ts` (HTTP endpoints and webhooks)
- `functions/src/services/openaiClient.ts` (AI responses + lead summarisation)
- `functions/src/services/stripeService.ts` (Checkout + webhooks helpers)
- `functions/src/services/twilioClient.ts`, `functions/src/services/whapiClient.ts`, `functions/src/calendlyWebhook.ts`
- Frontend routing in `src/App.tsx`

## 2) Data categories processed

### A) Customer account and admin users (Talmate as Controller)
- **Identifiers**: email, UID, name (if present), authentication metadata (Firebase Auth).
- **Purpose**: account access, security, support, abuse prevention, admin management.
- **Legal bases** (UK/EU): contract; legitimate interests (security); legal obligation (where applicable).
- **Argentina**: consent/contract + information duties; facilitate access/rectification/deletion.

### B) Billing and payments (Talmate as Controller)
- **Stripe IDs**: customer id, subscription id, default payment method id; checkout/session/payment intent metadata.
- **Purpose**: payments processing, invoicing, credit balance, subscription renewals, fraud prevention.
- **Legal bases**: contract; legal obligation (accounting); legitimate interests (fraud/security).

### C) Support and communications (Talmate as Controller)
- **Support interactions**: messages, tickets, diagnostics.
- **Purpose**: provide support, communicate service-related notices.
- **Legal bases**: contract; legitimate interests.

### D) Marketing communications (Talmate as Controller)
- **Direct marketing**: email/WhatsApp/SMS where used for Talmate’s own marketing.
- **Purpose**: product marketing, promotions, newsletters.
- **Legal bases**: consent and/or legitimate interests depending on jurisdiction and relationship (B2B), with opt-out.

### E) Website/app cookies & tracking (Talmate as Controller)
- **Essential**: session/auth/security.
- **Analytics**: usage measurement (vendor TBD).
- **Advertising/retargeting**: pixels/tags (vendors TBD).
- **Legal bases**: consent for non-essential cookies/ads; legitimate interests/consent for certain analytics depending on setup; essential cookies rely on necessity.

### F) Leads & conversations (Customer as Controller; Talmate as Processor)
Data as processed within the platform to run the customer’s bot and manage leads:
- **WhatsApp identifiers**: phone number (E.164 / canonical formats), chatId, message timestamps.
- **Content**: inbound/outbound message text; conversation history; bot state (language, tags, status flags).
- **Lead profiling**: name, household composition, income (numeric), pets, payment method (cash/mortgage), preferred visit availability, notes.
- **Listings**: listing codes, links, address and features.
- **Purpose (processor)**: run customer’s bot flows, qualify leads, allow manual messaging, analytics on lead handling, and produce summaries for agents.

### G) Voice/calls (Customer as Controller; Talmate as Processor)
- **Call data**: caller phone, call SID, timestamps, and (where enabled) **recordings** or recording URLs.
- **Purpose**: provide call handling/voicemail-like experience and WhatsApp handoff; operational records.

## 3) AI processing (OpenAI) — risk notes
- Conversation history and lead data may be sent to OpenAI to generate assistant responses and to produce structured lead summaries.
- The integration uses `store: false` on OpenAI responses API in code, but the legal docs must still treat this as disclosure to a sub-processor and address international transfers.
- The docs will include:
  - transparency for the customer (and templates for the customer to inform leads)
  - restrictions on prohibited inputs (special categories, secrets)
  - safeguards, minimisation, and retention.

## 4) Sub-processors / third parties (non-exhaustive)
Likely sub-processors, to be confirmed per deployment:
- **Google/Firebase**: Hosting, Firestore, Cloud Functions/Tasks, Auth, Logging.
- **Twilio**: WhatsApp messaging and Voice webhooks.
- **Whapi**: WhatsApp gateway API.
- **OpenAI**: AI generation and summarisation.
- **Stripe**: payments and subscriptions.
- **Calendly**: onboarding event webhooks and scheduling data.
- **(Optional) Vapi**: voice/call automation platform (present in codebase/services/scripts; confirm usage).
- **Analytics/Ads vendors**: TBD (e.g., Google Analytics, Meta Pixel, etc.).

For each sub-processor the legal pack will include: purpose, categories of data, location/transfer mechanism references, and a process for updates/objections (DPA).

## 5) International data transfers (high-level)
- Talmate is a UK company operating in **UK, Spain (EEA), and Argentina**.
- With cloud and AI providers, transfers may occur outside the UK/EEA/Argentina depending on vendor hosting/support operations.
- Legal documents will cover:
  - UK GDPR transfer tools (IDTA / UK Addendum to SCCs)
  - EU GDPR SCCs (where applicable)
  - Argentina international transfer requirements and contractual safeguards.

## 6) Retention (placeholders to be finalised)
Suggested structure (to be implemented in Retention Policy and DPA annex):
- **Account & billing**: per legal/accounting obligations (e.g., 6–10 years depending on jurisdiction).
- **Conversations/leads**: configurable by customer; default retention window (TBD).
- **Recordings**: minimal, with explicit default and deletion schedule (TBD).
- **Security/audit logs**: limited window (TBD).

## 7) Key legal documents this inventory supports
- `legal/terms.es.md` and `legal/terms.en.md`
- `legal/privacy-policy.es.md` and `legal/privacy-policy.en.md`
- `legal/cookies.es.md` and `legal/cookies.en.md`
- `legal/dpa.es.md` and `legal/dpa.en.md`
- `legal/subprocessors.md`
- `legal/lead-notice-template.es.md` / `legal/lead-notice-template.en.md`
- `legal/call-recording-notice.es.md` / `legal/call-recording-notice.en.md`

