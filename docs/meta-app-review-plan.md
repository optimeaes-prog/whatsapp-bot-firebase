# Proplead — Meta Tech Provider App Review: First-Try Approval Plan

## Context

Proplead (operated by Talmate Limited, UK) is a multi-tenant SaaS that lets real-estate agencies run AI-assisted WhatsApp conversations with leads. To operate in production on the WhatsApp Cloud API and manage WABAs **on behalf of clients**, Meta requires App Review approval for Advanced Access on `whatsapp_business_messaging` + `whatsapp_business_management` under the **Tech Provider** program. Business verification is already approved — this plan covers everything from here to a first-try approval.

The reviewer's mental model is: *"Can this app be trusted to manage another business's WABA without abusing permissions, leaking data, or violating the WhatsApp Business Messaging Policy?"* Every item below exists to pre-answer one of those concerns.

**Decisions already locked in:**
- Submission type: **Tech Provider** (Cloud API, on behalf of clients).
- Onboarding: **Embedded Signup primary, manual token entry retained only for internal admins**.
- Scope: **Both code/compliance fixes and Meta dashboard steps.**

---

## Part A — Code & Compliance Fixes (must ship before submission)

These map to gaps the Explore pass found in the current codebase. Ordered by reviewer risk.

### A1. Implement Embedded Signup (critical) — prototype now, production after approval

**Timing clarification (important):** Meta explicitly allows — and actually *requires* — you to build the Embedded Signup prototype **before** App Review, while the app is still in pre-publish state (often shown as **Publish = Unpublished**). In that phase:
- Only Meta users you've manually added as **App Testers / Roles** can complete the flow.
- You're subject to "Tech Provider onboarding limits" (a small cap on connected WABAs), which is fine for prototype + screencast.
- **You cannot onboard real paying customers until App Review approval** — approval + publish is what unlocks the production path.

So the sequence is: build A1 → add yourself + 1 tester (see B6) → record the screencast exercising Embedded Signup end-to-end against a test WABA → submit → approval flips production on. This is *the* expected path, and submitting **without** a working Embedded Signup prototype in the screencast is the most common first-try rejection reason for Tech Provider applications.

**Why reviewers insist on seeing it:** Without Embedded Signup in the screencast, reviewers treat manual token entry as evidence the app isn't really a Tech Provider and reject.

**What to build:**
- New onboarding step in [Onboarding.tsx](src/pages/Onboarding.tsx) — "Connect your WhatsApp Business Account" — shown between current step 1 (agency info) and step 3 (email). Gate on `organizationSettings.onboardingStep`.
- Load Meta JS SDK (`https://connect.facebook.net/en_US/sdk.js`) with `appId` from env.
- Button calls `FB.login(callback, { config_id: <FB Login for Business config_id>, response_type: 'code', override_default_response_type: true, extras: { setup: {}, featureType: '', sessionInfoVersion: '3' } })`.
- Listen for `window.addEventListener('message', ...)` with `event.data.type === 'WA_EMBEDDED_SIGNUP'` to capture `phone_number_id` and `waba_id` from `session_info_response`.
- POST the short-lived `code` to a new Cloud Function `exchangeEmbeddedSignupCode` which:
  1. Calls `GET https://graph.facebook.com/v23.0/oauth/access_token?client_id={appId}&client_secret={appSecret}&code={code}` to get the `business_integration_system_user_access_token` (long-lived, non-expiring for the granted WABA).
  2. Stores token in **Secret Manager** under `whatsapp_org_{orgId}_token` (reuse pattern already in [cloudApiClient.ts](functions/src/services/cloudApiClient.ts)).
  3. `POST /{phone_number_id}/register` with a 6-digit PIN to complete phone registration on Cloud API.
  4. `POST /{waba_id}/subscribed_apps` to subscribe Proplead's app to that WABA's webhooks.
  5. Writes `cloudApiConfig` to Firestore (`phoneNumberId`, `wabaId`, `verifyToken`, `accessTokenSecretName`, `graphApiVersion: 'v23.0'`).
- Keep the existing manual-token form in [AdminTools.tsx](src/pages/AdminTools.tsx) **gated behind `role === 'owner' && user.email in ADMIN_EMAILS`** — never shown to customers. This is the "admin fallback" path.

**New secrets needed:** `META_APP_ID`, `META_APP_SECRET`, `META_FB_LOGIN_CONFIG_ID`, `META_VERIFY_TOKEN` (single global value for webhook handshake — simpler than per-org).

### A2. Webhook signature verification (critical — reviewers test this)

[functions/src/index.ts](functions/src/index.ts) `whatsappWebhook` must enforce `X-Hub-Signature-256` validation on every POST. Implementation:

```ts
const raw = req.rawBody; // firebase-functions gives Buffer
const sig = req.header('x-hub-signature-256') || '';
const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(raw).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.status(401).end();
```

Pull `META_APP_SECRET` from Secret Manager (not env). This is the same secret used in A1.

### A3. Switch webhook endpoint to a single app-wide URL

Use only an app-wide endpoint for Meta webhook subscription (no per-org callback URLs):
- Single URL: `https://.../whatsappWebhook` (no query param).
- Resolve org by looking up the incoming `entry[].id` (that's the WABA ID) in Firestore (`organizations` where `botConfig.cloudApiConfig.wabaId == entry.id`). Add a Firestore index.
- Subscribe `messages`, `message_template_status_update`, `account_update`, `phone_number_name_update`, `message_echoes` (last is optional but reviewer-positive).

### A4. Data Deletion Callback (required for Meta app Basic Settings)

New endpoint `POST /metaDataDeletion` in [functions/src/index.ts](functions/src/index.ts):
1. Parse `signed_request` body, HMAC-SHA256 verify with `META_APP_SECRET`.
2. Extract `user_id` (Facebook-scoped ID).
3. Enqueue deletion job: find all `organizations/{orgId}/leads` where `fbUserId == user_id` (we don't store this today — for now return an empty job since we don't receive FB user IDs from Cloud API messages — but the endpoint MUST exist and respond correctly).
4. Return `{"url": "https://proplead.io/legal/deletion-status?code=XYZ", "confirmation_code": "<uuid>"}`.
5. Persist `{code, status: 'completed', requestedAt}` in a new `dataDeletionRequests` collection.
6. Add a public `/legal/deletion-status?code=XYZ` page in [src/pages/](src/pages/) that renders the status record.

### A5. Account deletion + DSAR endpoints (customer-facing)

- Add "Delete my account" button in Settings UI that calls a `deleteMyOrganization` callable: marks org `deletedAt`, schedules hard-delete in 30 days (soft-delete lets the user recover), revokes WhatsApp webhook subscription via `DELETE /{waba-id}/subscribed_apps`, deletes Secret Manager secret.
- Add "Export my data" button → zip of Firestore documents for the org, signed URL emailed via SendGrid.
- Link both from privacy policy.

### A6a. Opt-in capture and audit trail (required, was missing)

WhatsApp Business Messaging Policy requires **prior, explicit opt-in** per lead per business before any business-initiated message (including the first template). Proplead's agencies collect the lead's phone; Proplead must force them to also capture and retain evidence of consent.

**What to build:**
- New required field on `leads/{leadId}`: `consent: { capturedAt: Timestamp, source: 'idealista_form' | 'agency_website' | 'phone_call' | 'in_person' | 'inbound_whatsapp', proofUrl?: string, collectedBy: uid, language: 'es' | 'en' }`.
- Block `sendInitialTemplateMessage` in [messagingProvider.ts](functions/src/services/messagingProvider.ts) with a hard error if `lead.consent` is missing. Surface this in the UI as "Cannot message — no consent on file. Add consent proof first."
- In [Leads.tsx](src/pages/Leads.tsx) add a "Consent" modal: dropdown for source, optional URL/screenshot upload (stored in Firebase Storage), timestamp auto-filled, capturing user recorded.
- Inbound WhatsApp → auto-create consent record with `source: 'inbound_whatsapp'` and the inbound message timestamp; valid only for the 24h customer service window (template sends after 24h still require an explicit opt-in source).
- For the Idealista integration: the agency confirms in onboarding that their Idealista lead forms include the consent checkbox with Proplead-provided copy (template text in [legal/lead-notice-template.es.md](legal/lead-notice-template.es.md)).
- Audit log every consent creation and every template send with the consent record ID.

**Reviewer-visible evidence:** mention in the permission justification (C1) that opt-in is enforced server-side; demonstrate in the messaging screencast by attempting a template send to a consent-less lead and showing the blocking error.

### A6c. Cold-lead SMS opt-in bridge (Idealista → WhatsApp)

**Problem:** Idealista hands us a phone number but no WhatsApp consent checkbox, so a cold template send violates Meta's Business Messaging Policy. This gate is **provider-agnostic** — it applies whether we send via Cloud API or Twilio, because the policy governs Meta's platform, not the sender. The legacy Twilio path that template-blasts cold leads predates App Review and must be retired before submission.

**Flow:**
1. Agency lead arrives at `POST /newLead` (from Idealista webhook).
2. Instead of sending a WhatsApp template, send an SMS via Twilio with alphanumeric sender `"Marcos"`:
   > `Hola, {name20}. ¿Te has interesado este anuncio? idealista.com/inmueble/{listingCode}`
   > `Contáctanos por WhatsApp: proplead.io/w/{listingCode}?l={leadId}`
3. Lead clicks the short link → Firebase Hosting rewrite `/w/**` → `waRedirect` function → 302 to `https://wa.me/{displayPhoneNumber}?text=Hola,%20me%20interesa%20la%20vivienda%20{listingCode}`.
4. Lead taps "Send" in WhatsApp → inbound message arrives → 24h session window opens → **implicit opt-in**. Proplead creates consent record `{source: 'inbound_whatsapp', capturedAt: <inbound ts>, proofUrl: <inbound message sid>}`.
5. All subsequent replies during that window are free-form (no template needed).

**Immediately after inbound ("Hola, me interesa la vivienda XXXX") — required handling:**
1. Persist/refresh lead context from `listingCode` + inbound phone (`chatId`): lead name, assigned agent, listing highlights.
2. Generate a **session message** (not a template) as the first assistant response inside the 24h window.
3. Reply with this baseline structure (Spanish default):
   - `Hola, {leadName}. Gracias por tu interes en esta vivienda. Soy el asistente virtual de {agentName}, encantado de ayudarte.`
   - `Has visto las caracteristicas de la vivienda?`
   - `{CARACTERISTICAS_RESUMEN}`
   - `Si deseas darte de baja de estas conversaciones, responde BAJA.`
4. If `leadName` or `agentName` is missing, fall back gracefully (`Hola`, `nuestro equipo`) and keep the same compliance footer.

**Why this matters for review:** reviewers need to see that after user-initiated inbound contact, Proplead answers with contextual property information via a session message and always exposes a clear opt-out keyword (`BAJA`).

**Why this is compliant:** the lead's *outbound* WhatsApp message to us is what Meta treats as consent. We never send a marketing template to a number that hasn't first messaged us.

**Files / plumbing:**
- `functions/src/services/smsOptIn.ts` (NEW) — `sendIdealistaOptInSms({phoneE164, name, listingCode, leadId?, baseDomain?})`.
- `functions/src/services/twilioClient.ts` — add `sendSms({to, body})` + `TWILIO_SMS_SENDER_ID` defineString.
- `functions/src/services/embeddedSignup.ts` — `fetchDisplayPhoneNumber({phoneNumberId, accessToken})`; persist `cloudApiConfig.displayPhoneNumber` so `waRedirect` can build the `wa.me` link.
- `functions/src/index.ts` — `waRedirect` Cloud Function (validates `listingCode`, resolves org by listing code, reads `displayPhoneNumber`, 302s). `newLead` branch: drop `runIdealistaConfirmPipeline` for Idealista-sourced leads — create a minimal lead and call `sendIdealistaOptInSms` regardless of `messagingProvider`.
- `firebase.json` — add hosting rewrite `/w/** → waRedirect`.
- Config: `TWILIO_SMS_SENDER_ID=Marcos`.

**Reviewer-visible evidence:** mention in C1 that cold leads receive an SMS bridge and only enter WhatsApp after they initiate; demo in D1 by showing the SMS, the redirect, and the inbound-triggered conversation.

### A6d. Voice-call DTMF opt-in (global Proplead number)

**Problem:** Leads call a single global Proplead Twilio number (not per-agency numbers). We cannot infer tenant/org from the dialed number, so org resolution must happen after listing identification inside WhatsApp. Consent still must be explicit before the first outbound WhatsApp template.

**Flow:**
1. Inbound voice call hits Twilio → `voiceWebhook` returns TwiML:
   - `<Play>` audio 1 (existing greeting recording).
   - `<Pause length="3"/>`.
   - `<Gather numDigits="1" timeout="6" action="/voiceGatherCallback?phone=&chatId=&callSid=">`
     - `<Play>` audio 2: *"Para recibir información por WhatsApp, pulse 1. Si no, puede colgar."*
   - `<Hangup/>` (fallback if no input).
2. `voiceGatherCallback` reads `Digits`:
   - `"1"` → `<Say voice="Polly.Lucia-Neural">Gracias, le enviamos un WhatsApp ahora.</Say><Hangup/>` and, async: record `consent: {source: 'phone_call', proofUrl: <callSid>, capturedAt: now}`, then send the approved consent-template via `sendInitialTemplateMessage({templateSid: TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT})`.
   - anything else / no input → hang up, no WhatsApp send.

**Why this is compliant:** DTMF-1 is a verifiable, recorded affirmative action tied to the call SID (Twilio retains the recording / CDR). The template we send after is a MARKETING template dedicated to this opt-in path, text approved by Meta.

**Files / plumbing:**
- `functions/src/index.ts` — rewrite `voiceWebhook`; add `voiceGatherCallback`; global intake org routing + listing-driven handoff to target org WABA; helper `recordVoiceConsent`.
- Audio hosted at `https://proplead.io/audio/voice-optin-es.mp3` (added to `public/audio/`).
- Config: `VOICE_AUDIO_2_OPTIN_URL`, `TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT`.
- New Twilio Content template (no variables): *"¡Hola! Soy el asistente virtual… [body as supplied by operator]."*

**Reviewer-visible evidence:** C1 justification mentions that phone-call opt-in is captured via DTMF-1 with the call SID as proof; audit log shows the consent record before the template send. Not required in the screencast but handy if reviewers probe consent sources.

### A6b. Opt-out / STOP keyword handling

In the inbound message pipeline (after `parseCloudApiWebhook` in [cloudApiClient.ts](functions/src/services/cloudApiClient.ts), before Cloud Tasks buffer):
- If message body (normalized) matches `/^(stop|baja|cancelar|unsubscribe|dar de baja)$/i` → set `conversations/{convId}.optedOut = true`, write `ignoredChats/{chatId}`, and send a one-line confirmation reply. Never send template messages to opted-out chats.
- Gate `sendInitialTemplateMessage` in [messagingProvider.ts](functions/src/services/messagingProvider.ts) on `!conversation.optedOut`.

### A7. Lead privacy notice on first contact

When a template first reaches a new lead (any `idealista_initial_*` template), append a mandatory footer citing the existing [legal/lead-notice-template.es.md](legal/lead-notice-template.es.md). Add it as the template **footer** component so Meta approves it once; no per-message overhead.

### A8. Privacy Policy + Terms URLs reachable publicly

Reviewers open these URLs in an incognito window. Verify:
- `https://proplead.io/legal/privacy-policy` returns 200 with Spanish + English.
- `https://proplead.io/legal/terms` returns 200.
- `https://proplead.io/legal/data-deletion` returns 200 (user-facing instructions page, separate from A4 callback).
- All three must mention: WhatsApp Business Platform usage, data categories, Meta/Facebook as a sub-processor, retention, user rights, deletion request instructions.

### A9. App Secret Proof on Graph calls (defensive, reviewer-positive)

In [cloudApiClient.ts](functions/src/services/cloudApiClient.ts) requests, append `appsecret_proof = HMAC-SHA256(access_token, app_secret)`. Reduces risk of token-theft-enabled abuse; reviewers sometimes check.

### A10. Remove/gate Twilio in the default customer path

Reviewers see multiple providers and get confused about whether this is really a Cloud API integration. For the review submission:
- Default `messagingProvider` for all new orgs → `cloud_api`.
- Hide the Twilio provider picker from non-admin UI in [Onboarding.tsx](src/pages/Onboarding.tsx) and settings pages.
- Keep backend code for existing customers, but document in the reviewer notes that Cloud API is the published path.

---

## Part B — Meta Dashboard Setup (in order)

### B1. Business and app ownership prerequisites

**Required**
- `business.facebook.com` → `Business Settings` → `Business Info`: verification = **Verified**.
- App is connected to the same verified business portfolio.
- Domain `proplead.io` is verified under Brand Safety → Domains.

**Recommended**
- Confirm business restrictions are clear (no active account restrictions in Business Manager).

### B2. App settings (Basic)

`developers.facebook.com` → your app → `App settings` → `Basic`

**Required**
- App Icon: 1024x1024 Proplead logo.
- Category: **Business and Pages**.
  - Rationale: app is reviewed as WhatsApp Cloud API + Business Login (not Messenger Platform product UX).
- Privacy Policy URL: `https://proplead.io/legal/privacy-policy`.
- Terms of Service URL: `https://proplead.io/legal/terms`.
- User Data Deletion Callback URL: `https://api.proplead.io/meta-data-deletion`.
- Contact email: monitored operational mailbox.
- Business Use: select verified Talmate business.
- Business Verification shows **Verified**.

**Temporary fallback**
- If `api.proplead.io` DNS/SSL is still propagating, temporarily use:
  - `https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/metaDataDeletion`
- Replace with `https://api.proplead.io/meta-data-deletion` once custom domain is connected and SSL is provisioned.

**One-time custom domain setup (Firebase)**
1. Firebase Console → Hosting → Add custom domain `api.proplead.io`.
2. Add DNS verification/routing records exactly as Firebase provides.
3. Wait for status: Connected + SSL Provisioned.
4. Deploy: `firebase deploy --only hosting,functions:metaDataDeletion`.
5. Verify endpoint responds on `https://api.proplead.io/meta-data-deletion`.

### B3. WhatsApp product + webhook setup

`developers.facebook.com` → app → `Use cases` (WhatsApp) / `Products` (WhatsApp)

**Required**
- API Setup includes a test phone number for screencast/testing.
- Webhook callback URL points to:
  - `https://europe-west1-real-estate-idealista-bot.cloudfunctions.net/whatsappWebhook`
- Verify Token equals `META_VERIFY_TOKEN`.
- Subscribed webhook fields:
  - `messages`
  - `message_template_status_update`
  - `account_update`
  - `phone_number_name_update`

**Recommended**
- Re-run webhook verify handshake after any callback URL/token change.
- Confirm events are received in logs before submission.

### B4. Facebook Login for Business configuration (Tech Provider path)

`developers.facebook.com` → app → `Facebook Login for Business` → Create configuration

**Required**
- Configuration type: **Business Login for WhatsApp**.
- Include required permissions for Embedded Signup flow:
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`
  - `business_management` (only in Login configuration, not as Advanced Access request unless truly needed).
- Assets: WhatsApp Business Account (read/write), Business Portfolio.
- Save and copy `config_id` into secret `META_FB_LOGIN_CONFIG_ID`.

### B5. Test access model before publish

This is required because Publish is gated and reviewers/testers need access while app is still `Unpublished`.

**Required**
1. `App Roles` → `Roles`: add all human testers (Admin/Developer/Tester) and ensure invites are accepted.
2. In Business Settings, grant WABA access to the same testers so Embedded Signup can complete against a real test WABA.

**Fallback (Meta platform limitation)**
- If Meta shows `The ability to create test users is disabled temporarily`, do not block B5.
- Proceed with `App Roles` + real human tester accounts only.
- `Test Users` are optional for screencast privacy; they are not required to complete Tech Provider onboarding.

**Optional**
- `App Roles` → `Test Users`: create 1-2 synthetic users for screencast privacy if Meta enables this feature again.

**Recommended**
- Keep one dedicated reviewer-ready account (`meta-reviewer@proplead.io`) with stable credentials for the full review window.

### B6. Submit App Review (new checklist flow)

Current flow is checklist-driven under `Review` and may show cards like `Allowed usage`, `Data handling`, and `Reviewer instructions`.

**Required**
1. Request Advanced Access only for:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
2. Complete permission forms with project-specific text from Part C.
3. Upload separate screencast per permission (Part D).
4. Add reviewer instructions and test credentials (Part E).
5. Ensure submission is **submitted**, not draft.

**Required constraints**
- One video per permission (do not combine both into one clip).
- One written justification per permission (no copy-paste generic text).
- Do not request extra permissions unless a concrete product flow requires them.

### B7. Operate during `In review` / `Needs your review`

**Required**
- Monitor both:
  - `Alert Inbox`
  - `Review` → requests/checklist status
- If status shows `Needs your review`, open the flagged card, apply requested fixes, and resubmit.

**Recommended**
- When reviewer asks for clarification, update both the screencast and written description so they match exactly.
- Avoid rapid no-change resubmits.

### B8. Publish transition (new UI behavior)

**Expected UI behavior**
- Left navigation may show `Publish` with status `Unpublished`.
- Old Development/Live toggle may not be visible.

**Required**
1. Finish Tech Provider onboarding + App Review checklist items.
2. Resolve all outstanding review actions (`Needs your review` / pending checklist cards).
3. Return to `Publish` page and publish once unblocked.

**Rule**
- Treat `Publish` as the final step after review readiness/approval, not as a prerequisite to start App Review.

---

## Part C — Permission Justification Text (ready to paste)

### C1. `whatsapp_business_messaging`

> Proplead is a Tech Provider for real-estate agencies in Spain and Latin America. After a client onboards via Embedded Signup and connects their own WhatsApp Business Account, Proplead uses `whatsapp_business_messaging` to send and receive messages **on behalf of that client**. Specifically: (1) inbound webhook events (`messages` field) are received when a prospective buyer/tenant contacts the agency; Proplead routes the message to the correct client tenant, persists it for the agency's CRM view, and the agency's configured AI assistant replies within the 24-hour customer service window; (2) outside the 24-hour window, Proplead sends **pre-approved MARKETING and UTILITY templates** (e.g., "idealista_initial_es", "agent_notification_es") to re-engage the lead with property information the lead previously requested. All lead phone numbers originate from inbound contact or first-party explicit opt-in collected by the agency (consent source, timestamp, and collecting user are persisted per lead and server-side enforced — Proplead blocks any template send to a lead without a consent record). Leads can withdraw consent at any time with "STOP" / "BAJA" / "CANCELAR" keywords, which are honored automatically and stored per conversation. Proplead never sends unsolicited marketing.

### C2. `whatsapp_business_management`

> Proplead uses `whatsapp_business_management` exclusively to manage the assets of client WhatsApp Business Accounts that clients explicitly grant us via Embedded Signup. Specifically: (1) after Embedded Signup we call `POST /{phone-number-id}/register` to complete Cloud API phone registration and `POST /{waba-id}/subscribed_apps` to subscribe our app to that WABA's webhooks; (2) we programmatically create six message templates per WABA (property confirmation, yes/no confirmation, agent notification — each in Spanish and English) via `POST /{waba-id}/message_templates`, and poll their `quality_score` / `status` via `GET /{template-id}` to surface approval state to the agency in our dashboard; (3) we read phone-number display-name and quality-rating updates via webhook `account_update` and `phone_number_name_update` to alert the agency when Meta flags issues. We do not modify business profile, payment method, or access tokens for any WABA we don't own.

### C3. Pitfall to avoid in both texts
Do **not** describe internal architecture (Firestore, Cloud Tasks, etc.). Reviewers want to know *what users see* and *why the permission is necessary*, not the stack.

---

## Part D — Screencast Specification

Two videos, **one per permission**, each 60–120 seconds, 1080p, MP4, no music, English narration (captions optional).

### D1. Messaging screencast storyboard

1. (0–5s) Title card: "Proplead — whatsapp_business_messaging demo".
2. (5–15s) Browser at proplead.io → log in as test agency owner → land on dashboard.
3. (15–30s) Open "Connect WhatsApp" → click "Login with Facebook" → **complete Embedded Signup** with the test WABA. Show `phone_number_id` being persisted.
4. (30–55s) Open a second device / simulator → send an inbound WhatsApp message to the test number → show it appearing in Proplead's Conversations UI within seconds → show the AI-generated reply being delivered back to WhatsApp on the second device. This is the session-message path.
5. (55–90s) From the UI, trigger a template send to a number outside the 24h window → show the approved template rendering on WhatsApp (property confirmation template). This is the template-message path.
6. (90–110s) Send "BAJA" from the consumer → show conversation auto-marked opted-out in the UI → attempt to re-send template fails gracefully.

### D2. Management screencast storyboard

1. (0–5s) Title card.
2. (5–20s) Log in → Admin Tools → "Create Cloud API templates" → click → show 6 templates being created via `POST /{waba}/message_templates`.
3. (20–40s) Show template list in Proplead UI reflecting `PENDING → APPROVED` status synced from Meta.
4. (40–70s) Show the WABA connection flow (same Embedded Signup clip) emphasizing the `subscribed_apps` call and webhook subscription toggles.
5. (70–90s) Show the agency's "Phone number health" panel reading `quality_rating` from `account_update` webhook events.

### D3. Screencast red flags reviewers penalize
- Postman / curl / terminal — must be the **business-facing UI**.
- Real consumer PII on screen — blur or use fake names.
- Any mention of Twilio — hide that provider toggle (see A10).
- Skipping Embedded Signup — if they don't see it, they assume it doesn't exist.

---

## Part E — Reviewer Instructions Block (paste into App Review form)

> **Test credentials**
> - URL: https://proplead.io
> - Email: meta-reviewer@proplead.io
> - Password: (set a strong one, rotate after approval)
> - The test account is pre-seeded with one property listing and a demo WABA subscription.
>
> **Step-by-step reproduction**
> 1. Sign in at the URL above.
> 2. Go to "Connect WhatsApp" in the left nav.
> 3. Click "Login with Facebook" — use the test WhatsApp Business Account you created during onboarding. If you prefer, Proplead provides a pre-connected demo WABA on this account so you can skip this step.
> 4. From a personal WhatsApp, send a message to +34 XXX XXX XXX ("I'm interested in listing 123456"). The message appears in "Conversations" and receives an AI reply within 10 seconds.
> 5. In "Conversations", click any lead and select "Send re-engagement template" to exercise the `whatsapp_business_messaging` template path.
> 6. In "Admin → Templates", click "Sync templates" to exercise the `whatsapp_business_management` path. Status updates appear live.
> 7. From the personal WhatsApp, reply "BAJA" to confirm opt-out handling.
>
> **Notes**
> - Webhook signature (`X-Hub-Signature-256`) is validated against the App Secret for all inbound events.
> - Access tokens issued via Embedded Signup are stored in Google Secret Manager, never in plaintext databases.
> - Data deletion callback: POST to `/metaDataDeletion` returns the required `{url, confirmation_code}` JSON.

---

## Part F — Pre-Submission Verification Checklist

Run this **end-to-end** before hitting Submit. Each item must pass.

- [ ] A live client WABA is connected via Embedded Signup in production (not the test one). Reviewers favor apps with real traffic.
- [ ] Production URL `https://proplead.io` is reachable without VPN from the US (Meta reviewers are US-based). Test from a non-EU IP.
- [ ] Privacy Policy, Terms, Data Deletion pages all return 200 in incognito.
- [ ] Data Deletion Callback tested with a real `signed_request` POST — returns `{url, confirmation_code}` in under 1s.
- [ ] Webhook signature verification: send a POST with an invalid `X-Hub-Signature-256` — returns 401.
- [ ] Webhook signature verification: send a valid one — returns 200 and processes the message.
- [ ] Embedded Signup completes end-to-end on a **second Meta business account** (not Talmate) — confirms multi-tenant works.
- [ ] Template messages are all in `APPROVED` state on the demo WABA. Reviewer must see them working, not pending.
- [ ] STOP/BAJA flow tested with a real WhatsApp send.
- [ ] In Meta dashboard, App Review cards are complete (no unresolved `Needs your review` item).
- [ ] App Review request is actually submitted (not draft).
- [ ] Business Verification = Verified in Business Settings.
- [ ] Only `whatsapp_business_messaging` and `whatsapp_business_management` are requested in App Review — no extra permissions.
- [ ] Both screencasts uploaded (MP4, under 100MB each), one per permission.
- [ ] Reviewer test credentials work from a fresh browser session.
- [ ] Twilio toggle hidden from the customer UI path that reviewers will see.
- [ ] Publish page is rechecked after App Review updates; if still `Unpublished`, confirm no pending action in `Alert Inbox`.

---

## Part G — Files Touched (summary)

New:
- `functions/src/services/embeddedSignup.ts` — code-for-token exchange, register phone, subscribe apps.
- `functions/src/metaDataDeletion.ts` — data deletion callback (A4).
- `src/pages/ConnectWhatsApp.tsx` — Embedded Signup UI (A1).
- `src/pages/DeletionStatus.tsx` — public status page (A4).
- `legal/data-deletion.en.md` + `.es.md` — user-facing DSR instructions.

Modified:
- [functions/src/index.ts](functions/src/index.ts) — implement `whatsappWebhook` (single app-wide endpoint) with signature verification and WABA-based org routing; add `exchangeEmbeddedSignupCode`, `deleteMyOrganization`, `exportMyData`.
- [functions/src/services/cloudApiClient.ts](functions/src/services/cloudApiClient.ts) — add `appsecret_proof` (A9); switch org resolution to `wabaId`.
- [functions/src/services/messagingProvider.ts](functions/src/services/messagingProvider.ts) — gate sends on `optedOut`.
- [src/pages/Onboarding.tsx](src/pages/Onboarding.tsx) — insert Connect WhatsApp step; hide provider switcher for non-admins (A10).
- [src/pages/AdminTools.tsx](src/pages/AdminTools.tsx) — gate manual token entry behind admin role (A1).
- [firestore.rules](firestore.rules) — allow self-serve `deletedAt` write; restrict `dataDeletionRequests` to server.
- [firestore.indexes.json](firestore.indexes.json) — add index on `botConfig.cloudApiConfig.wabaId`.
- [legal/privacy-policy.en.md](legal/privacy-policy.en.md) + `.es.md` — explicit DSR instructions; Meta as sub-processor.

---

## Part H — Verification (how to prove it works end-to-end)

1. `firebase deploy --only functions` to staging project. Run `curl -X POST https://.../whatsappWebhook` with a crafted signed payload and verify 200/401 behaviors.
2. On a staging Meta app with a fresh Business, run the Embedded Signup flow as a **different Meta user** than the Proplead owner — confirm a new `cloudApiConfig` document is written and a template can be sent.
3. Run `curl -X POST https://.../metaDataDeletion -d 'signed_request=<signed>'` — assert response shape `{url, confirmation_code}`.
4. Send `BAJA` from a real WhatsApp to the test number — assert `conversations/{id}.optedOut === true` and next template send is blocked.
5. Record both screencasts against the **staging** environment first, watch them yourself at 1x speed, confirm no sensitive info leaks and every narration claim is visibly demonstrated.
6. Promote to prod, submit App Review, track status in Alert Inbox/Requests, then publish from the Publish page when unlocked.

## Part I — If rejected

Meta rejections cite a specific permission and usually a specific clip timestamp. Typical first-round rejections and fixes:
- *"Insufficient demonstration of management permission"* → re-record D2 showing template creation API call result, not just the UI state.
- *"App uses data in a way not described"* → check that justification text C1/C2 matches the exact behaviors in the screencast word-for-word.
- *"Privacy Policy does not cover Meta data usage"* → add an explicit "WhatsApp Business Platform & Meta" section naming the permissions requested.
- *"Data deletion instructions unclear"* → ensure `/legal/data-deletion` has a numbered step-by-step and a direct email contact (dpo@proplead.io).

Expect 3–5 business days per review cycle. Do not resubmit within 24h of rejection without concrete changes; reviewers flag spammy resubmits.

---

## Part J — Implementation Status Audit (as of 2026-04-23)

This section tracks what has been implemented in the codebase versus what remains outstanding for first-try App Review approval.

Legend:
- ✅ Done — implemented and wired in code.
- 🟡 Partial — implemented in part, but missing required pieces from this plan.
- ❌ Not done — not implemented yet.
- 🔍 Not code-verifiable — likely dashboard/ops/manual, not confirmable from repository only.

### J1. Part A — Code & Compliance Fixes

#### A1. Embedded Signup (critical)
Status: ✅ Done

Implemented:
- ✅ Frontend Meta Embedded Signup service exists in `src/services/embeddedSignup.ts`:
  - SDK load from `https://connect.facebook.net/en_US/sdk.js`
  - `FB.login` with `config_id`, `response_type: "code"`, `override_default_response_type: true`, and `extras.sessionInfoVersion = "3"`.
  - `window.postMessage` listener for `WA_EMBEDDED_SIGNUP` and extraction of `phone_number_id` + `waba_id`.
- ✅ Backend exchange endpoint exists in `functions/src/index.ts` as `exchangeEmbeddedSignupCode`:
  - Exchanges code for token.
  - Stores token in Secret Manager as `whatsapp_org_{orgId}_token`.
  - Calls `/{phone_number_id}/register`.
  - Calls `/{waba_id}/subscribed_apps`.
  - Persists Cloud API config in Firestore.
- ✅ Secret parameters exist in `functions/src/secrets.ts`:
  - `META_APP_ID`, `META_APP_SECRET`, `META_FB_LOGIN_CONFIG_ID`, `META_VERIFY_TOKEN`.
- ✅ Dedicated page exists: `src/pages/ConnectWhatsApp.tsx`.
- ✅ Plan-required onboarding insertion is implemented in `src/pages/Onboarding.tsx` (Connect WhatsApp step tied to onboarding progression).
- ✅ Manual-token admin fallback is implemented and gated in `src/pages/AdminTools.tsx`, with backend role/email enforcement in `functions/src/index.ts` (`setManualCloudApiConfig`).

Notes:
- ✅ `exchangeEmbeddedSignupCode` and `setManualCloudApiConfig` both persist the global `META_VERIFY_TOKEN` (no per-org random fallback).

#### A2. Webhook signature verification
Status: ✅ Done

Implemented:
- ✅ Signature verification is present in `functions/src/index.ts` for:
  - `whatsappWebhook`
- ✅ Uses raw body + HMAC SHA256 + timing-safe compare.
- ✅ Reads app secret from `META_APP_SECRET` secret parameter.

Notes:
- This is reviewer-critical and currently covered.

#### A3. Single app-wide webhook URL
Status: ✅ Done

Implemented:
- ✅ `whatsappWebhook` is the single app-wide endpoint in `functions/src/index.ts`.
- ✅ No query-param org routing is used; org is resolved by WABA ID via `wabaIndex/{wabaId}`.
- ✅ `wabaIndex` is written during Embedded Signup persistence in `functions/src/services/embeddedSignup.ts`.
- ✅ Legacy `cloudApiWebhook` endpoint has been removed from the backend.

#### A4. Data Deletion Callback
Status: ✅ Done

Implemented:
- ✅ `metaDataDeletion` endpoint exists in `functions/src/index.ts`.
- ✅ Verifies `signed_request` signature with `META_APP_SECRET`.
- ✅ Stores request in `dataDeletionRequests`.
- ✅ Returns `{ url, confirmation_code }`.
- ✅ Public status page exists in `src/pages/DeletionStatus.tsx`.
- ✅ Route exists in `src/App.tsx`: `/legal/deletion-status`.
- ✅ Firestore rules allow public read and deny client writes to `dataDeletionRequests`.

#### A5. Account deletion + DSAR endpoints
Status: ✅ Done

Implemented:
- ✅ `deleteMyOrganization` endpoint exists:
  - Soft delete marker on org.
  - Best-effort `DELETE /{waba-id}/subscribed_apps`.
  - Deletes org token secret.
  - 30-day hard-delete scheduled sweep (`purgeDeletedOrganizations`).
- ✅ `exportMyData` endpoint exists:
  - Collects org Firestore data.
  - Writes ZIP export file to Storage.
  - Generates signed URL.
  - Emails requester via SendGrid.
- ✅ UI buttons exist in `src/pages/Configuracion.tsx` for export/delete actions.
- ✅ Legal links and canonical public URLs are aligned under `/legal/*`:
  - `/legal/privacy-policy`
  - `/legal/terms`
  - `/legal/data-deletion`

#### A6a. Opt-in capture + audit trail
Status: ✅ Done

Implemented:
- ✅ `LeadRow` type includes `consent` shape in `functions/src/types.ts`.
- ✅ `sendInitialTemplateMessage` enforces opt-in/opt-out gate for template sends in `functions/src/services/messagingProvider.ts`.
- ✅ Consent capture UI is available via `src/components/ConsentModal.tsx`, wired in `src/pages/Leads.tsx`.
- ✅ Optional consent proof upload is implemented in `src/services/storage.ts` (Firebase Storage) and linked to consent save.
- ✅ Server-side endpoint `setLeadConsent` exists in `functions/src/index.ts` with auth + allowed source/language validation.
- ✅ Inbound implicit consent is auto-stamped through `ensureInboundWhatsAppConsentByChatId` (`functions/src/services/firestore.ts`) and called from `processBufferedMessages`.
- ✅ Explicit audit events are emitted for consent capture and auto-capture (`consent_captured`, `consent_auto_captured`).

#### A6c. Cold-lead SMS opt-in bridge (Idealista)
Status: ✅ Done

Implemented:
- ✅ New service `functions/src/services/smsOptIn.ts` with expected SMS message pattern.
- ✅ `sendSms` added in `functions/src/services/twilioClient.ts` using `TWILIO_SMS_SENDER_ID`.
- ✅ `newLead` path switched to SMS opt-in pipeline (`runIdealistaConfirmPipeline`) in `functions/src/index.ts`.
- ✅ `waRedirect` function exists and hosting rewrite `/w/** -> waRedirect` configured in `firebase.json`.
- ✅ Display phone number support exists (`fetchDisplayPhoneNumber` + persistence in cloudApiConfig).

#### A6d. Voice-call DTMF opt-in
Status: ✅ Done

Implemented:
- ✅ `voiceWebhook` updated to include gather flow.
- ✅ `voiceGatherCallback` implemented.
- ✅ `recordVoiceConsent` writes consent record with call SID proof.
- ✅ Post-consent template send path exists.
- ✅ Config knobs present for audio/template IDs in code via param definitions.

#### A6b. STOP / opt-out handling
Status: ✅ Done

Implemented:
- ✅ Opt-out detection exists in `functions/src/services/optOut.ts`.
- ✅ Inbound webhook checks opt-out before buffering in both `webhook` and `whatsappWebhook` (`functions/src/index.ts`).
- ✅ Opted-out chats are written to `ignoredChats` and receive confirmation reply.
- ✅ `conversations/{chatId}.optedOut = true` mirror is now written for UI visibility.
- ✅ Template-send gate blocks if chat is ignored in `functions/src/services/messagingProvider.ts`.
- ✅ UI visibility is implemented in `src/pages/Conversations.tsx` with opt-out badge/filter and send guard.
- ✅ Explicit audit event is emitted on opt-out capture (`opt_out_captured`).

Notes:
- `cancelar` remains intentionally excluded from STOP regex to avoid collisions with normal scheduling language; canonical opt-out keywords remain active (`stop`, `baja`, `unsubscribe`, `dar de baja`, etc.).

#### A7. Lead privacy notice on first contact template
Status: ✅ Done

Implemented:
- ✅ `createCloudApiTemplates` in `functions/src/index.ts` includes template footer text on initial templates and agent-notification templates.
- ✅ STOP/BAJA style compliance footer is included.

#### A8. Public legal URLs (privacy/terms/data-deletion)
Status: ✅ Done

Implemented:
- ✅ Exact public URLs are available and routed:
  - `https://proplead.io/legal/privacy-policy`
  - `https://proplead.io/legal/terms`
  - `https://proplead.io/legal/data-deletion`
- ✅ Legacy redirects maintained for compatibility (`/privacy` -> `/legal/privacy-policy`, `/terms` -> `/legal/terms`).
- ✅ `/legal/privacy-policy` now contains Spanish + English sections in one page for incognito reviewer checks.
- ✅ All three legal pages explicitly mention:
  - WhatsApp Business Platform usage
  - data categories
  - Meta/Facebook as provider/sub-processor context
  - retention/deletion framing
  - user rights and deletion request instructions
- ✅ A8-facing legal docs no longer contain draft markers/placeholders.

Reviewer-visible verification:
- `curl -I -L https://proplead.io/legal/privacy-policy` -> `HTTP/2 200`
- `curl -I -L https://proplead.io/legal/terms` -> `HTTP/2 200`
- `curl -I -L https://proplead.io/legal/data-deletion` -> `HTTP/2 200`

#### A9. App Secret Proof on Graph calls
Status: ✅ Done

Findings:
- ✅ `appsecret_proof` is now added for Graph calls in `functions/src/services/cloudApiClient.ts`:
  - `sendText`
  - `sendTemplate`
  - `createMessageTemplate`
  - `checkCloudApiHealth`
- ✅ Embedded Signup token-authenticated Graph calls now include `appsecret_proof` in `functions/src/services/embeddedSignup.ts`:
  - `registerPhoneNumber`
  - `subscribeAppToWaba`
  - `fetchDisplayPhoneNumber`
- ✅ `deleteMyOrganization` now sends `appsecret_proof` on `DELETE /{wabaId}/subscribed_apps` as additional hardening.

Action to close:
- Keep this as the standard for all new Graph API calls (append `appsecret_proof` wherever access-token auth is used).

#### A10. Remove/gate Twilio from default customer path
Status: ✅ Done

Implemented:
- ✅ Default provider for new org config is `cloud_api` in `src/services/botConfig.ts`.
- ✅ Missing provider values are normalized to `cloud_api` in `src/services/botConfig.ts`.
- ✅ Customer-facing settings (`src/pages/Configuracion.tsx`) do not expose any provider picker.
- ✅ Provider switching UI remains available only in internal admin tooling (`src/pages/AdminTools.tsx`) and is gated to `super_admin`.

Action to close:
- Keep this policy stable for App Review: Cloud API is the published/default path, Twilio is an internal-only fallback control.

---

### J2. Part B — Meta Dashboard Setup

Status: 🔍 Not code-verifiable

Notes:
- Items B1–B8 are mostly Meta console/business configuration tasks (domain verification, publish gating, webhook setup in app dashboard, app review form submission, reviewer test users).
- These cannot be reliably confirmed from repository source alone.

Operational checklist to confirm manually:
- Business verified and domain verified.
- Publish page state reviewed; unresolved App Review actions cleared before final publish.
- WhatsApp webhook in Meta dashboard points to `.../whatsappWebhook`.
- Verify token configured as `META_VERIFY_TOKEN`.
- Embedded Signup FB Login configuration created and config ID set.
- Test users/roles configured and validated.

---

### J3. Part C — Permission Justification Text

Status: 🟡 Partial (ready text exists, but must align with actual behavior)

Notes:
- Draft text in this plan is usable, but before submission ensure all claims are strictly true in production behavior.
- Current code no longer shows the previously listed A6a/A9/A10 implementation gaps.
- Remaining fidelity risk is operational: confirm production behavior and reviewer narrative stay aligned with the latest deployed version.

---

### J4. Part D — Screencasts

Status: 🔍 Not code-verifiable / not done in repo

Notes:
- No screencast artifacts are tracked in codebase.
- Once A1/A6/A10/A8 are fully aligned, record D1 + D2 exactly per storyboard.

---

### J5. Part E — Reviewer Instructions Block

Status: 🔍 Not code-verifiable

Notes:
- Submission form content is manual.
- Ensure instructions reflect actual routes shown in product (especially Connect WhatsApp and legal URLs).

---

### J6. Part F — Pre-submission checklist

Status: 🟡 Mixed

Likely pass from code:
- ✅ Signature verification behavior exists.
- ✅ Data deletion callback endpoint exists.
- ✅ App-wide webhook endpoint exists.

Likely fail/open:
- 🔍 Publish gating / review uploads / real reviewer account and WABA state are manual and unverified.

---

### J7. Priority Order to Reach Submission-Ready State

1. **Validate manual Meta setup**: B1–B8 in dashboard, including Publish gating status, webhook settings, and Embedded Signup test roles.
2. **Harden reviewer evidence**: record D1/D2 screencasts strictly matching visible product behavior and permission narratives.
3. **Run full checklist** in Part F with real end-to-end smoke tests before submit.
4. **Freeze reviewer-facing UX copy/routes** to avoid drift between screencasts, reviewer steps, and production UI.

## Part K — Per-Org Template Ownership Cutover (2026-04-26)

Policy alignment implemented:
- Template ownership is now enforced per organization/WABA for both Twilio and Cloud API.
- Global template fallback is retired from runtime send paths.
- Missing required per-org template keys now produce fail-closed behavior.

Operational controls added:
- `callHandoffReadiness` now returns authoritative eligibility and `missingRequiredKeys`.
- `backfillPerOrgTemplateEligibility` marks orgs blocked/unblocked for outbound templates using:
  - `botConfig.templateEligibility.outboundTemplatesBlocked`
  - `botConfig.templateEligibility.missingRequiredKeys`

Required per-org keys at cutover:
- Twilio: `voiceOptInConsent`, `callHandoffOrgEs`, `callHandoffOrgEn`, `idealistaInitialEs`, `idealistaInitialEn`, `agentNotification`.
- Cloud API: `callHandoffOrgEs`, `callHandoffOrgEn`, `idealistaInitialEs`, `idealistaInitialEn`, `agentNotification`.
