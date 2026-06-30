# Codebase Overview

_Generated: 2026-06-28. Read-only audit of the repository at the root of this file._

---

## 1. Executive Summary

This repository is a multi-tenant SaaS platform operated under the **Proplead** brand at `proplead.io`. It contains two live products sharing a single Firebase project (`real-estate-idealista-bot`):

1. **WhatsApp / Voice Bot** — an AI-powered lead-qualification chatbot for real estate agencies. When a prospective buyer or tenant contacts a property listing, the bot qualifies them via WhatsApp conversation (asks about finances, move-in date, pets, number of occupants) using OpenAI GPT-4o and notifies the listing agent when a lead meets the criteria.

2. **Propglow** — an AI virtual staging product (images, brochures, PDFs) billed separately. Frontend pages reference it but the back-end work is in the Cloud Run services (`brochure-pdf-service`, `slow-video-service`) which are outside this repo's `functions/` tree.

Both products share the same Firebase Auth, Firestore database (`realestate-whatsapp-bot`), Cloud Functions deployment, hosting, and Stripe billing.

The repository root serves as both the **React SPA frontend** (Vite build → `dist/`) and the monorepo container for `functions/` (Node.js 24 Cloud Functions). There are no explicit workspaces; they use separate `package.json` files at root and `functions/`.

---

## 2. Tech Stack

### Backend (Cloud Functions)
| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 24 |
| Language | TypeScript | ^5.3 |
| Functions framework | firebase-functions v2 (Gen 2 / Cloud Run) | ^7.2 |
| Database client | firebase-admin | ^13.8 |
| AI | OpenAI SDK | ^4.28 |
| Billing | Stripe | ^20.3 |
| Schema validation | Zod | ^3.25 |
| Secret storage | @google-cloud/secret-manager | ^5.6 |
| Task queue | @google-cloud/tasks | ^5.1 |
| Email (transactional) | @sendgrid/mail + nodemailer | ^8.1 / ^7 |
| Data export | jszip | ^3.10 |
| HTTP client | axios | ^1.16 |
| WhatsApp (provider A) | Twilio Messaging API | REST via axios |
| WhatsApp (provider B) | Meta WhatsApp Cloud API | Graph API v23.0 via axios |
| Voice | Twilio Voice + TwiML | REST via axios |
| TTS | ElevenLabs | REST via axios |
| Voice AI | Vapi | REST via vapiService |

### Frontend (React SPA)
| Layer | Technology | Version |
|---|---|---|
| Framework | React | ^19.2 |
| Build | Vite | ^7.2 |
| Language | TypeScript | ~5.9 |
| Routing | react-router-dom | ^7.12 |
| Server state | @tanstack/react-query | ^5.90 |
| Styling | Tailwind CSS | ^4.1 |
| Firebase SDK | firebase | ^12.8 |
| Toast notifications | sonner | ^2.0 |
| Icons | lucide-react | ^0.563 |
| Calendar embed | @calcom/embed-react + react-calendly | ^1.5 / ^4.4 |
| HTTP client | axios | ^1.13 |

### Infrastructure
| Layer | Technology |
|---|---|
| Firebase project | `real-estate-idealista-bot` |
| Firestore database | `realestate-whatsapp-bot` (named, non-default) |
| Functions region | `europe-west1` (all functions) |
| Hosting domain | `proplead.io` (Firebase Hosting) |
| Secret management | GCP Secret Manager |
| Task queue | GCP Cloud Tasks |
| Storage | Firebase Storage |

---

## 3. Repository Structure

```
/
├── src/                         # React SPA source
│   ├── App.tsx                  # Router with all routes
│   ├── main.tsx                 # Vite entry point
│   ├── pages/                   # 34 page components
│   ├── components/              # Shared UI components
│   ├── contexts/                # AuthContext, CookieConsentContext
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # firebase.ts, analytics.ts, etc.
│   ├── services/                # Frontend API call wrappers
│   ├── types/                   # Frontend TypeScript types
│   ├── utils/                   # Frontend utilities
│   └── i18n/                    # (not present in main src; i18n is backend-side)
├── functions/                   # Cloud Functions (Node.js 24, TypeScript)
│   ├── src/
│   │   ├── index.ts             # 10,821-line main entry; all exported functions
│   │   ├── types.ts             # Shared TypeScript types (ConversationState, LeadRow, etc.)
│   │   ├── shared.ts            # REGION constant + re-exports
│   │   ├── secrets.ts           # Centralised Secret Manager param definitions
│   │   ├── schemas.ts           # Zod schemas (SendMessage, NewLead, etc.)
│   │   ├── appConfig.ts         # App-level configuration constants
│   │   ├── passwordResetEndpoints.ts
│   │   ├── emailPreferenceEndpoints.ts
│   │   ├── emailUnsubscribeParams.ts
│   │   ├── calendlyWebhook.ts
│   │   ├── utils.ts
│   │   ├── services/            # 30 service modules
│   │   ├── utils/               # 5 utility modules
│   │   ├── tests/               # 17 test files (Node.js built-in test runner)
│   │   └── scripts/             # 11 one-off admin/migration scripts
│   ├── .env.real-estate-idealista-bot  # TRACKED (see section 11)
│   ├── package.json
│   └── tsconfig.json
├── docs/                        # Documentation files
├── dist/                        # Built SPA (gitignored)
├── firebase.json                # Firebase project configuration
├── .firebaserc                  # Project alias (default → real-estate-idealista-bot)
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Composite index definitions
├── storage.rules                # Storage security rules
├── .gitignore
├── .env.example                 # Only VITE_GA_MEASUREMENT_ID
├── package.json                 # Frontend package
├── tsconfig.json                # Root TypeScript config
└── vite.config.ts               # Vite configuration
```

### `functions/src/services/` (30 files)
`alertCatalog.ts`, `alertService.ts`, `assistantAvatars.ts`, `auditService.ts`, `authTriggers.ts`, `billingService.ts`, `cloudApiClient.ts`, `cloudTasks.ts`, `conversationSyncService.ts`, `elevenLabsClient.ts`, `emailCommunicationPreferencesDb.ts`, `emailPreferenceToken.ts`, `emailService.ts`, `emailTemplates.ts`, `embeddedSignup.ts`, `firestore.ts`, `messagingProvider.ts`, `notificationNumbersService.ts`, `openaiClient.ts`, `optOut.ts`, `qualifiedLeadNotificationTargets.ts`, `recoveryService.ts`, `reminderService.ts`, `requestContext.ts`, `smsOptIn.ts`, `stripeService.ts`, `subscriptionService.ts`, `twilioClient.ts`, `twilioMigration.ts`, `twilioMigrationTypes.ts`, `twilioOnboarding.ts`, `twilioVerify.ts`, `vapiService.ts`

### `functions/src/tests/` (17 files)
`appsecretProof.test.ts`, `conversationHistoryPersistence.test.ts`, `creditDeduction.test.ts`, `globalMessagingPolicyFlow.test.ts`, `inboundVoiceHandoffFlow.test.ts`, `languageStabilityFlow.test.ts`, `listingNotificationResolver.test.ts`, `notificationNumberNormalization.test.ts`, `outboundVoiceReliabilityFlow.test.ts`, `planLimitsNotificationNumbers.test.ts`, `qualifiedLeadNotificationTargets.test.ts`, `rankedCallHandoffFlow.test.ts`, `replyLanguageInference.test.ts`, `replyLanguageRouter.test.ts`, `twilioCustomerCareWindow.test.ts`, `twilioMigration.test.ts`, `twilioVerify.test.ts`

### Frontend Pages (`src/pages/`)
`AdminOnboards`, `AdminTools`, `AdminTwilioMigration`, `Alerts`, `AuditLog`, `BotTest`, `Captaciones`, `Configuracion`, `ConnectWhatsApp`, `Conversations`, `Dashboard`, `DeletionStatus`, `EmailGallery`, `EmailPreferences`, `ForgotPassword`, `Landing`, `Leads`, `LegalDoc`, `Listings`, `Login`, `MarketingLanding`, `MarketingLandingV2`, `Onboarding`, `Organizacion`, `ResetPassword`, `Seguimiento`, `Signup`, `SignupInvitation`, `Subscription`, `Usage`, `Users`, `WhatsAppAnimationLab`, `WhatsAppLeadsAnimation`, `FontGallery`

---

## 4. Architecture Overview

### Multi-tenant Model
Every tenant is an **organization** identified by a string `orgId`. All Firestore data lives under `organizations/{orgId}/...`. A `requestContext` (Node.js `AsyncLocalStorage`) carries the active `orgId` through each request's async call chain, ensuring service functions always write to the correct org's collections without needing to pass `orgId` explicitly.

### Dual Messaging Provider Architecture
Each org may use either **Twilio** or the **Meta WhatsApp Cloud API** as its messaging transport. The active provider is stored in `organizations/{orgId}/botConfig/config.messagingProvider`. A global messaging policy (`globalMessagingPolicy` Firestore doc) holds platform-wide defaults and template name mappings. The `messagingProvider.ts` service resolves the right client at send-time.

Per-org Twilio credentials are stored as separate Twilio subaccounts with auth tokens in GCP Secret Manager under the key `twilio_org_{orgId}_auth_token`. The master Twilio account (whose SID/token are in Secret Manager) creates and manages subaccounts via the Twilio REST API during onboarding (Embedded Signup).

### Inbound Message Flow (WhatsApp)
```
Lead sends WhatsApp message
  → Twilio/Meta webhook (POST /twilioWebhook or /whatsappWebhook)
      → Signature/token verification
      → Idempotency check (rate limiter, duplicate detection)
      → addPendingMessage() writes to Firestore
      → scheduleBufferTask() enqueues a Cloud Tasks HTTP task (10-second delay)
  → Cloud Tasks fires processBuffer (POST /processBuffer)
      → getPendingMessagesAndClear() atomically reads and clears the buffer
      → processBufferedMessages() runs the conversation state machine
          → Language detection (rule-based + optional GPT fallback)
          → flowStep routing:
              call_listing_collect → call_listing_confirm
              call_name_collect → call_name_confirm → cross-org handoff
              qualification → OpenAI GPT-4o assistant response
              closed → (no further processing)
          → On qualification/rejection: sends WhatsApp template to agent
      → upsertConversation() saves updated conversation history to Firestore
```

### Cross-Org Call Handoff
An intake WABA (organization ID stored in `PROPLEAD_INTAKE_ORG_ID` env var) handles inbound voice calls. The voice flow:
1. Caller reaches Twilio voice webhook → TwiML plays an audio message, gathers DTMF
2. Caller presses "1" to consent → DTMF consent is recorded
3. `executeCrossOrgCallHandoff` resolves the target org by listing code, charges 2 credits (idempotent), sends a WhatsApp template message to the lead, and seeds an initial conversation history in the target org's WABA

### Conversation State Machine (`flowStep`)
```
call_listing_collect  — bot asks which listing the caller is interested in
  → call_listing_pick — when multiple candidates (AI shortlist), bot presents options
  → call_listing_confirm — bot confirms the resolved listing
    → call_name_collect — bot asks caller's name
      → call_name_confirm — bot confirms the name
        → qualification — OpenAI assistant drives open conversation qualification
          → closed — lead marked qualified or rejected; no further bot replies
```

### Billing / Conversations System
Credits are denominated as "conversations." Each org has a balance tracked in `organizations/{orgId}/org_conversations`. Deductions happen when `processBufferedMessages` starts a new qualification conversation. The system supports:
- Stripe subscription plans: `free`, `plus`, `pro`, `pro_plus` with monthly or annual billing
- One-time top-ups: packages of 40 conversations at €10 each
- Auto-recharge: when balance drops below a threshold, a Stripe PaymentIntent is triggered automatically
- Proration: plan upgrades immediately grant prorated additional conversations
- Cross-org handoff charges: 2 credits billed to the target org per handoff, idempotent

### Firestore Triggers (Audit Log)
Four `onDocumentWritten` triggers watch key collections and write to `organizations/{orgId}/audit_logs`:
- `onLeadWritten` — also enforces listing agent scope assignment and triggers qualified-lead notifications
- `onConversationWritten` — tracks bot-toggle and qualification status changes
- `onListingWritten` — syncs `assignedAgentUid` to all leads for the listing; enforces plan-based cap on `notificationNumberIds`
- `onConfigWritten` — records changes to `botConfig/config`

### Scheduled Functions
| Function | Schedule | Purpose |
|---|---|---|
| `checkFollowUps` | Hourly | Send follow-up messages to leads with no response |
| `sendDueReminders` | Every 15 min | Fire `seguimiento` reminders when due |
| `syncConversationsTask` | Every 30 min | Sync conversation state between in-memory cache and Firestore |
| `twiceDailyStatusReportTask` | 09:00 + 21:00 Madrid | Health report via alert service |
| `retryFailedMessagesTask` | Every 15 min | Retry failed WhatsApp message sends |
| `analyzeLeadsAgent` | 00:00, 06:00, 12:00, 18:00 Madrid | GPT-4o extracts pets/income/paymentMethod from conversations |
| `pollPendingTwilioMigrations` | (scheduled) | Poll Meta for template approval status during org migrations |
| `purgeDeletedOrganizations` | (scheduled) | Hard-delete orgs marked for deletion after retention period |

---

## 5. Key Modules and Components

### `functions/src/index.ts` (10,821 lines)
The single entry point for all Cloud Functions exports. Contains:

**Initialization (lines 1–230)**
- Firebase Admin SDK initialization (idempotent)
- Firestore settings (`ignoreUndefinedProperties: true`)
- `defineString` config params: `NOTIFICATION_NUMBER`, `VOICE_AUDIO_1_URL`, `VOICE_AUDIO_2_OPTIN_URL`, `PROPLEAD_INTAKE_ORG_ID`, `VOICE_CONSENT_SCRIPT_VERSION`, `OUTBOUND_CALLER_NUMBER`, `OUTBOUND_AUDIO_BUCKET`, `APP_BASE_URL`, `STRIPE_PRICE_TOPUP_40_CONVS`

**Helper / Utility Layer (lines 230–1080)**
- `buildTwiml(body)` — TwiML XML construction
- `WEB_CLIENT_CORS` — CORS config for web-client endpoints (origin whitelist)
- `checkAndRecordRateLimit` — IP-based rate limiting using Firestore
- `verifyTwilioSignature` / `verifyTwilioSignatureAnyUrl` — HMAC validation of Twilio webhooks
- `resolveOrgIdFromToken` / `resolveUserContextFromToken` / `resolveAuthIdentityFromToken` — Firebase ID token verification → org/role lookup from `users/{uid}`
- Madrid time utilities: `getMadridTimeParts`, `isMadridBusinessSlot`, `alignToMadridBusinessSlot`, `nextBusinessDaySameTimeFromReference`
- Phone normalization helpers (E.164, Spanish prefix rules)
- Listing resolution helpers: `fetchListingByCode`, `resolveListingFromText` (AI shortlist via OpenAI)

**Language Detection (lines 1080–1150)**
- `isLikelySpanishReply`, `isLikelyEnglishReply` — keyword/pattern heuristics
- `resolveReplyLanguageFromMessages` — combines rule-based and GPT-4o classification with a language lock/guardrail system

**Conversation State (lines 1054–1730)**
- In-memory `Map<string, ConversationState>` keyed by `orgId:phone:listingCode`
- `ensureConversationState` — cache-miss fills from Firestore, lead lookup, listing lookup
- Conversation states carry: `flowStep`, `history`, `pendingUserMessages`, `handoff`, `outboundCallConsent`, `language`, `targetLanguage`, `languageLockSource`

**Cross-Org Handoff (lines 1732–2079)**
- `chargeDestinationOrgForHandoff` — idempotent 2-credit deduction with correlationId
- `executeCrossOrgCallHandoff` — full handoff: sends transition message in source org, sends WA template in target org, seeds conversation history

**`processBufferedMessages` (lines 2121–2993)**
The core bot brain. Invoked as a Cloud Tasks HTTP handler. Orchestrates:
- Buffer drain + message ordering
- Language inference and lock management
- Consent recording (`ALLOWED_CONSENT_SOURCES`)
- Name extraction for call flow
- Full `flowStep` state machine traversal
- OpenAI assistant call for qualification responses
- Lead notification on status change

**HTTP Exports Catalog (lines 2995–10,821)**

Grouped by domain:

_Webhooks & Bot_
- `webhook` / `twilioWebhook` — Twilio inbound WhatsApp POST
- `whatsappWebhook` — Meta Cloud API inbound GET (verification) + POST (messages)
- `voiceWebhook` / `voiceGatherCallback` — Twilio Voice TwiML
- `processBuffer` — Cloud Tasks target for buffered message processing
- `triggerBot` — manual bot trigger from UI
- `newLead` / `newLeadLegacy` / `newLeadCallConsent` — new lead intake
- `sendCallHandoffMessage` / `processCallHandoffTimeout` — call handoff control

_Outbound Voice_
- `outboundCallRetryTask`, `outboundConsentVoiceWebhook`, `outboundConsentGatherCallback`, `outboundConsentStatusCallback` — outbound DTMF consent call system

_Messaging_
- `sendMessage` — send a freeform message to a lead
- `sendMassMessage` — bulk message sending
- `retryMissingLeads`, `syncMissedMessages` — recovery utilities

_Twilio Onboarding & Migration_
- `exchangeEmbeddedSignupCode` — Meta/Twilio OAuth code exchange during onboarding
- `getEmbeddedSignupConfig` — returns META_APP_ID/TWILIO_PARTNER_SOLUTION_ID to frontend
- `setManualCloudApiConfig` — manually configure Cloud API credentials
- `createTwilioTemplates` / `createCloudApiTemplates` — provision WhatsApp message templates
- `startTwilioSenderMigration`, `submitTwilioMigrationTemplates`, `pollTwilioMigrationJob`, `forceCompleteTwilioMigrationJob`, `retryTwilioMigrationStep` — multi-step org Twilio account migration
- `exchangeEmbeddedSignupCode`, `backfillPerOrgTemplateEligibility`, `migrateTwilioTransportToOrg`

_Messaging Policy_
- `getGlobalMessagingPolicyConfig` / `setGlobalMessagingPolicyConfig` — super_admin only
- `setPlatformDefaultProviderConfig`, `seedGlobalMessagingPolicy`
- `setOrgMessagingProvider` / `clearOrgMessagingProviderOverride`
- `setLeadConsent`, `setLeadConsentByChatId`

_Organization & Auth_
- `bootstrapUserOrganization` — creates org + first user record
- `activateFreePlan` — opt into free tier
- `listOrganizationsForSuperAdmin` — super_admin only
- `reconcileAgentScopeForOrganization` — batch fix `assignedAgentUid` across leads
- `deleteMyOrganization` — soft-delete with retention
- `exportMyData` — GDPR JSZip export of all org data
- `purgeDeletedOrganizations` — scheduled hard delete

_Team Management_
- `sendInvitation`, `getInvitationPreview`, `acceptInvitation` — token-based email invitations (7-day expiry)
- `updateTeamMember` — name, role, notification numbers
- `getSystemUsers` — super_admin only, lists Firebase Auth users

_Subscription & Billing_
- `createSubscriptionCheckout` — Stripe Checkout session for subscription plans
- `getSubscription` — current org plan from Firestore
- `createBillingPortalSession` — Stripe billing portal
- `createStripeCheckout` — one-time credit top-up checkout
- `saveAutoRechargeSettings` / `getAutoRechargeSettings` — auto-recharge config
- `previewSubscriptionChange` — proration preview
- `updateSubscriptionPlan` — in-place Stripe subscription update
- `stripeWebhook` — handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`, `payment_intent.succeeded/payment_failed`
- `getPackages` / `getConversations` — conversation balance and package listing

_Monitoring & Alerts_
- `getAlertCatalogStatus`, `setAlertEnabled`, `runAlertCheck` — system alert management
- `ignoreChatForSync`, `triggerSync`, `triggerAnalyzeLeads` — diagnostic/super_admin tools
- `healthz` — health check endpoint

_Email_
- `emailPreferencesApi` — email preference management
- `emailUnsubscribe` — one-click unsubscribe
- `testEmailTemplates` — super_admin only, sends test emails
- `passwordResetRequest` — custom password reset flow (delegates to `passwordResetEndpoints.ts`)

_Notification Numbers_
- `startNotificationNumberVerification`, `checkNotificationNumberVerification`, `deleteNotificationNumber` — Twilio Verify SMS OTP flow for verifying agent notification numbers

_Audit_
- `getAuditLogs` — query `organizations/{orgId}/audit_logs`

_Firestore Triggers_
- `onLeadWritten`, `onConversationWritten`, `onListingWritten`, `onConfigWritten`

_Redirect_
- `waRedirect` — `/w/**` → `wa.me` with pre-filled text (listing inquiry shortlink)
- `metaDataDeletion` — Meta App Review data deletion callback

### `functions/src/services/`

| File | Responsibility |
|---|---|
| `requestContext.ts` | `AsyncLocalStorage` wrapper — `getActiveOrgId()` |
| `firestore.ts` | All Firestore read/write operations (the data layer) |
| `openaiClient.ts` | GPT-4o conversation assistant, listing resolution, name extraction, language classification, lead detail summarization (`summarizeLeadDetails`), qualification filter checks |
| `twilioClient.ts` | Twilio REST API (send WA message, send SMS, create/fetch templates, manage senders, verify credentials) |
| `cloudApiClient.ts` | Meta Graph API (send WA message, create templates, get phone profile) |
| `messagingProvider.ts` | Provider-agnostic `sendMessage` that dispatches to Twilio or Cloud API |
| `stripeService.ts` | Stripe SDK wrapper (checkout sessions, billing portal, subscription management, proration) |
| `subscriptionService.ts` | Conversation balance ledger (`addOrgConversations`, `deductOrgConversations`, `grantSubscriptionConversations`) |
| `billingService.ts` | Auto-recharge logic, `getOrgStripeCustomerId`, payment failure notifications |
| `cloudTasks.ts` | `scheduleBufferTask`, `scheduleImmediateHttpTask` — enqueue Cloud Tasks HTTP requests |
| `emailService.ts` | Nodemailer / Twilio Email (SendGrid SMTP) outbound email |
| `emailTemplates.ts` | HTML email formatters (welcome, low_balance, payment_failed, invitation, password_reset, support_inquiry, new_signup_alert) |
| `alertService.ts` | `sendAlert`, `sendHealthReport` — writes to `system_alerts` collection and emails `ALERT_EMAIL_RECIPIENT` |
| `alertCatalog.ts` | `ALERT_CATALOG` constant — catalog of known alert types with keys and descriptions |
| `auditService.ts` | `recordLeadChange`, `recordConversationChange`, `recordListingChange`, `recordSystemAction` |
| `conversationSyncService.ts` | `syncConversations` — reconciles in-memory state with Firestore; detects stale buffers |
| `recoveryService.ts` | `retryFailedMessages` — retries messages that failed on initial send |
| `reminderService.ts` | `runDueReminders` — fires scheduled follow-up messages (`seguimiento`) |
| `notificationNumbersService.ts` | CRUD for `organizations/{orgId}/notificationNumbers` collection |
| `qualifiedLeadNotificationTargets.ts` | `resolveQualifiedLeadNotificationRecipients` — determines which agent numbers get notified |
| `twilioMigration.ts` | Multi-step Twilio account migration: snapshot templates, clone to new account, submit for approval |
| `twilioMigrationTypes.ts` | Types and constants for migration jobs (`TwilioMigrationJob`, collection names) |
| `twilioOnboarding.ts` | `exchangeEmbeddedSignupCode` logic (Meta token exchange, Twilio subaccount creation) |
| `twilioVerify.ts` | Twilio Verify Service wrappers (`twilioVerifyStart`, `twilioVerifyCheck`) |
| `embeddedSignup.ts` | Meta Embedded Signup token exchange helpers |
| `elevenLabsClient.ts` | ElevenLabs TTS API (generate outbound voice audio for consent calls) |
| `vapiService.ts` | Vapi (voice AI) API helpers |
| `optOut.ts` | `isChatIgnored`, `ignoreChat` — WhatsApp opt-out tracking |
| `smsOptIn.ts` | SMS opt-in consent helpers |
| `emailCommunicationPreferencesDb.ts` | Email unsubscribe preference persistence |
| `emailPreferenceToken.ts` | HMAC-signed email preference tokens |
| `assistantAvatars.ts` | Predefined assistant persona catalog (avatar ID, name, image URL) |

### `functions/src/utils/`

| File | Responsibility |
|---|---|
| `requestContext.ts` | (also in services — re-exported) |
| `rateLimit.ts` | `enforceRateLimit` using Firestore counter with TTL |
| `cloudTasksAuth.ts` | `verifyCloudTasksOidc` — verifies OIDC JWTs from Cloud Tasks |
| `cors.ts` | CORS helper |
| `addressNormalize.ts` | Spanish address normalization |
| `organizationDisplayName.ts` | `organizationDisplayNameFromOrgDoc` — resolves a human-readable org name |

### Frontend (`src/`)

The SPA is a standard React 19 + react-router-dom v7 application. All navigation is client-side with Firebase Hosting `**` rewrite to `/index.html`. Key architecture points:

- `AuthContext` wraps Firebase Auth (`onAuthStateChanged`) and exposes `currentUser` and the user's Firestore profile (role, orgId)
- `ProtectedRoute` redirects unauthenticated users to `/login`
- `Layout` component wraps authenticated pages (sidebar navigation, header)
- Backend calls go to `https://{REGION}-{PROJECT_ID}.cloudfunctions.net/{functionName}` via axios with `Authorization: Bearer {idToken}`
- TanStack Query 5 manages caching and refetching of server state
- Google Analytics 4 via `VITE_GA_MEASUREMENT_ID`

Route inventory (from `App.tsx`):

| Path | Component | Auth Required |
|---|---|---|
| `/` | MarketingLandingV2 | No |
| `/login`, `/signup`, `/invite` | Auth pages | No |
| `/forgot-password`, `/reset-password` | Password recovery | No |
| `/email-preferences` | EmailPreferences | No |
| `/legal/*`, `/cookies`, `/aviso-legal` | LegalDoc | No |
| `/legal/deletion-status` | DeletionStatus | No |
| `/dashboard` | Dashboard | Yes |
| `/onboarding` | Onboarding | Yes |
| `/connect-whatsapp` | ConnectWhatsApp | Yes |
| `/anuncios` | Listings | Yes |
| `/captaciones` | Captaciones | Yes |
| `/leads` | Leads | Yes |
| `/seguimiento` | Seguimiento | Yes |
| `/conversaciones` | Conversations | Yes |
| `/configuracion` | Configuracion | Yes |
| `/organizacion` | Organizacion | Yes |
| `/usuarios` | Users | Yes |
| `/suscripcion` | Subscription | Yes |
| `/uso` | Usage | Yes |
| `/alerts` | Alerts | Yes |
| `/audit-log` | AuditLog | Yes |
| `/bot-test` | BotTest | Yes |
| `/admin/onboards` | AdminOnboards | Yes (super_admin) |
| `/admin/tools` | AdminTools | Yes (super_admin) |
| `/admin/twilio-migration` | AdminTwilioMigration | Yes (super_admin) |
| `/_internal/whatsapp-*` | Animation labs | Yes |

---

## 6. External Integrations

### OpenAI
- **Service:** `functions/src/services/openaiClient.ts`
- **Model:** Configured via `OPENAI_MODEL` env var (currently `gpt-5.1` in the tracked env file)
- **Uses:** Qualification conversation assistant, listing resolution (AI shortlist from lead's free-text), name extraction from voice transcripts, language classification, lead detail summarization (pets/income/paymentMethod/notes), listing qualification filter evaluation
- **Secret:** `OPENAI_API_KEY` in GCP Secret Manager

### Twilio
- **Service:** `functions/src/services/twilioClient.ts`
- **Uses:**
  - WhatsApp message send (per-org subaccount credentials)
  - SMS (fallback/opt-in)
  - Voice webhooks (TwiML), DTMF gather
  - Content API (WhatsApp message templates)
  - Twilio Verify (SMS OTP for agent notification number verification)
  - Embedded Signup (Tech Provider flow — master account creates subaccounts)
- **Secret:** `TWILIO_AUTH_TOKEN`, `TWILIO_ACCOUNT_SID` (master), `TWILIO_API_KEY`, `TWILIO_API_SECRET` (email SMTP via Twilio SendGrid), per-org auth tokens in Secret Manager as `twilio_org_{orgId}_auth_token`
- **Partner Solution ID:** `TWILIO_PARTNER_SOLUTION_ID` secret

### Meta WhatsApp Cloud API
- **Service:** `functions/src/services/cloudApiClient.ts`
- **Uses:** WhatsApp message send (for orgs using Cloud API provider), template creation, profile management
- **Secret:** Per-org access tokens in Secret Manager (referenced by `cloudApiConfig.accessTokenSecretName`)
- **Webhook verification:** `META_VERIFY_TOKEN` secret; per-org `cloudApiConfig.verifyToken`
- **App auth:** `META_APP_ID`, `META_APP_SECRET`, `META_FB_LOGIN_CONFIG_ID` in Secret Manager

### Stripe
- **Service:** `functions/src/services/stripeService.ts`, `subscriptionService.ts`, `billingService.ts`
- **Uses:** Subscription checkout sessions, billing portal, one-time top-ups, subscription update/proration, auto-recharge PaymentIntents, webhook event handling
- **Secret:** `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, price ID secrets (`STRIPE_PLUS_PRICE_ID`, etc.)
- **Hardcoded price IDs** (fallback): `STRIPE_PRICES` object in `index.ts` (lines 8528–8541) contains live Stripe price IDs

### ElevenLabs
- **Service:** `functions/src/services/elevenLabsClient.ts`
- **Uses:** Text-to-speech for outbound consent voice calls
- **Secret:** `11LABS_KEY` in Secret Manager
- **Hardcoded voice ID:** `7QQzpAyzlKTVrRzQJmTE`
- **Storage:** Generated audio uploaded to GCS bucket `OUTBOUND_AUDIO_BUCKET`

### Vapi
- **Service:** `functions/src/services/vapiService.ts`
- **Uses:** Voice AI (assistant/phone number management)
- **Secret:** `VAPI_API_KEY` in Secret Manager
- **Env:** `VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` in tracked env file

### SendGrid / Email
- **Dual path:** SendGrid via `@sendgrid/mail` SDK (primary) and Nodemailer SMTP via Twilio Email (fallback)
- **Secret:** `SENDGRID_API_KEY`
- **SMTP config:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` in tracked env file (smtp.gmail.com)
- **Alert recipient:** `ALERT_EMAIL_RECIPIENT` in tracked env file

### Firebase / GCP
- **Firestore:** Non-default database ID `realestate-whatsapp-bot`
- **Auth:** Firebase Authentication (ID tokens, password reset, user management)
- **Cloud Tasks:** `scheduleBufferTask` (10-second delay for message buffering), `scheduleImmediateHttpTask` (name timeout tasks)
- **Secret Manager:** All sensitive credentials
- **Storage:** Voice audio files, Propglow images
- **Hosting:** SPA at `proplead.io`

### Calendly
- **Service:** `functions/src/calendlyWebhook.ts`
- **Secret:** `CALENDLY_WEBHOOK_SIGNING_KEY`, `CALENDLY_PAT`
- **Uses:** Calendly webhook events (scheduling integration)

### Make.com (Formerly Integromat)
- Inbound lead webhook from Idealista portal (property listing portal)
- **Secret:** `MAKE_WEBHOOK_SHARED_SECRET` for HMAC validation

### Google Analytics 4
- **Frontend:** `VITE_GA_MEASUREMENT_ID` (exposed in `.env.example`: `G-7JTKQSCGPH`)
- Page tracking via `usePageTracking` hook, custom events via `analytics.ts`

---

## 7. Configuration and Environment

### Secret Manager Secrets (all via `defineSecret` in `secrets.ts`)
| Secret Name | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API |
| `TWILIO_AUTH_TOKEN` | Master Twilio auth token |
| `TWILIO_ACCOUNT_SID` | Master Twilio account SID |
| `TWILIO_PARTNER_SOLUTION_ID` | Twilio Tech Provider Solution ID |
| `PROPLEAD_TEMPLATE_SOURCE_ORG` | Source org ID for template cloning |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service SID |
| `VAPI_API_KEY` | Vapi voice AI API key |
| `11LABS_KEY` | ElevenLabs TTS API key |
| `MAKE_WEBHOOK_SHARED_SECRET` | Make.com webhook HMAC secret |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Calendly webhook signing key |
| `CALENDLY_PAT` | Calendly personal access token |
| `ADMIN_TEMPLATE_TOKEN` | Admin template management token |
| `STRIPE_PRICE_TOPUP_40_CONVS` | Stripe price ID for 40-conversation top-up |
| `SENDGRID_API_KEY` | SendGrid (email) API key |
| `TWILIO_API_KEY` | Twilio Email (SendGrid SMTP) API key SID |
| `TWILIO_API_SECRET` | Twilio Email (SendGrid SMTP) API key secret |
| `META_APP_ID` | Meta App ID for Embedded Signup |
| `META_APP_SECRET` | Meta App secret |
| `META_FB_LOGIN_CONFIG_ID` | Meta Facebook Login config ID |
| `META_VERIFY_TOKEN` | Meta webhook verify token |
| `twilio_org_{orgId}_auth_token` | Per-org Twilio auth tokens (dynamic, created at onboarding) |
| `{orgId}_cloud_api_access_token` | Per-org Meta Cloud API access tokens (pattern) |

### `defineString` Firebase Function Config Params
| Param | Purpose |
|---|---|
| `NOTIFICATION_NUMBER` | Fallback agent notification WhatsApp number |
| `VOICE_AUDIO_1_URL` | URL of TTS audio clip 1 for voice consent calls |
| `VOICE_AUDIO_2_OPTIN_URL` | URL of TTS audio clip 2 (opt-in) for consent calls |
| `PROPLEAD_INTAKE_ORG_ID` | Org ID of the intake WABA that handles inbound voice calls |
| `VOICE_CONSENT_SCRIPT_VERSION` | Version string recorded on consent capture |
| `OUTBOUND_CALLER_NUMBER` | E.164 number used for outbound consent calls |
| `OUTBOUND_AUDIO_BUCKET` | GCS bucket for ElevenLabs-generated audio |
| `APP_BASE_URL` | Base URL for generating email links |
| `STRIPE_PRICE_TOPUP_40_CONVS` | (also a secret param) |

### Tracked Environment File (`functions/.env.real-estate-idealista-bot`)
This file is committed to the repository (see section 11). It contains non-secret runtime configuration:

| Variable | Value type |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` | Email SMTP config |
| `ALERT_EMAIL_RECIPIENT` | Alert email destination |
| `VAPI_ASSISTANT_ID`, `VAPI_PHONE_NUMBER_ID` | Vapi resource IDs |
| `TWILIO_TEMPLATE_SID_AGENT_NOTIFICATION` | WhatsApp template SID |
| `TWILIO_TEMPLATE_SID_VOICE_OPTIN_CONSENT` | WhatsApp template SID |
| `TWILIO_TEMPLATE_SID_CALL_HANDOFF_ORG_ES/EN` | WhatsApp template SIDs |
| `OPENAI_MODEL` | OpenAI model name (currently `gpt-5.1`) |
| `NOTIFICATION_NUMBER` | Default agent notification number |
| `TWILIO_SMS_SENDER_ID` | SMS sender ID (alphanumeric) |
| `VOICE_AUDIO_2_OPTIN_URL` | Voice audio URL |
| `PROPLEAD_INTAKE_ORG_ID` | Intake org ID |
| `VOICE_CONSENT_SCRIPT_VERSION` | Consent script version |
| `OUTBOUND_CALLER_NUMBER` | Outbound voice caller ID |
| `OUTBOUND_AUDIO_BUCKET` | GCS bucket name |
| `LANGUAGE_GUARDRAIL_ENABLED` | Boolean feature flag |
| `LANGUAGE_GUARDRAIL_DRY_RUN` | Boolean feature flag |

No secret values (tokens, keys, passwords) were found in this file.

### Frontend Environment
- Only `VITE_GA_MEASUREMENT_ID` is used at frontend build time. The value (`G-7JTKQSCGPH`) is present in `.env.example`; this is the GA4 Measurement ID which is conventionally public.
- Firebase SDK config (API key, project ID, etc.) is embedded in `src/lib/firebase.ts` (standard Firebase web app pattern; the Firebase web API key is a public identifier, not a secret)

---

## 8. Build, Run, and Deploy

### Development
```bash
# Frontend dev server
npm run dev                  # Vite HMR at localhost:5173

# Functions dev
cd functions
npm run serve                # Builds TS then starts Firebase emulators (functions only)
npm run shell                # Firebase functions:shell (interactive REPL)

# Twilio dev phone (tests inbound WhatsApp)
npm run twilio:dev           # Requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN in functions/.env
```

### Build
```bash
# Frontend
npm run build                # tsc -b && vite build → dist/

# Functions
cd functions && npm run build  # tsc → functions/lib/
```

### Test
```bash
cd functions
npm test
# Equivalent: npm run build && node --test lib/tests/**/*.test.js
```
Uses Node.js 24's built-in test runner (`node --test`). No Jest or Vitest.

### Deploy
Per `CLAUDE.md`:
```bash
npm run build                         # MUST run before hosting deploy
firebase deploy --only hosting        # Deploy SPA
firebase deploy --only functions      # Deploy Cloud Functions (auto-runs tsc predeploy)
firebase deploy                       # Deploy everything
```

A `PreToolUse` hook in `.claude/settings.json` enforces the build-before-deploy rule.

---

## 9. Testing

### Test Runner
Node.js 24 built-in test runner (`node --test`). Tests are TypeScript compiled to `functions/lib/tests/*.test.js` before execution.

### Test Suite Results (as of audit date)
- **Total:** 141 tests across 17 files
- **Passing:** 132
- **Failing:** 9

The 9 failing tests are assertion-based checks against source code patterns in `twilioMigration.ts` and `rankedCallHandoffFlow.ts`. These appear to be "architecture tests" (they assert that specific code patterns exist in source, using regex against the compiled JS source string). The failures indicate that the code does not match the expected patterns — either the assertions are stale relative to code changes, or the patterns are written for a prior code structure.

Failing test names:
- `twilio inbound webhook resolves org by destination number before chat lookup` (rankedCallHandoffFlow.test.ts)
- `startMigration writes target botConfig before clone loop (so freeform works immediately)` (twilioMigration.test.ts)
- `startMigration reuses an existing in-flight job for the same target org (idempotent)` (twilioMigration.test.ts)
- `Job completion requires THIS job's approvals (stale pre-existing SIDs don't count)` (twilioMigration.test.ts)
- 5 additional failures (from earlier in the run, not captured in the tail)

### Test Coverage by Area
| Test File | What It Tests |
|---|---|
| `appsecretProof.test.ts` | Meta app secret proof HMAC |
| `conversationHistoryPersistence.test.ts` | Conversation history read/write |
| `creditDeduction.test.ts` | Conversation balance deduction logic |
| `globalMessagingPolicyFlow.test.ts` | Provider resolution from global policy |
| `inboundVoiceHandoffFlow.test.ts` | Voice intake → cross-org handoff flow |
| `languageStabilityFlow.test.ts` | Language lock/guardrail stability |
| `listingNotificationResolver.test.ts` | Agent notification recipient resolution |
| `notificationNumberNormalization.test.ts` | Phone number E.164 normalization |
| `outboundVoiceReliabilityFlow.test.ts` | Outbound consent call retry logic |
| `planLimitsNotificationNumbers.test.ts` | Plan-based notification number caps |
| `qualifiedLeadNotificationTargets.test.ts` | Qualified lead notification target resolution |
| `rankedCallHandoffFlow.test.ts` | Ranked (multi-listing) call handoff |
| `replyLanguageInference.test.ts` | Language detection heuristics |
| `replyLanguageRouter.test.ts` | Language routing decisions |
| `twilioCustomerCareWindow.test.ts` | 24-hour messaging window enforcement |
| `twilioMigration.test.ts` | Twilio account migration idempotency and logic |
| `twilioVerify.test.ts` | Twilio Verify SDK wrappers |

---

## 10. Code Quality Observations

### Monolithic Entry Point
`functions/src/index.ts` is 10,821 lines and contains not only exported Cloud Functions but also substantial business logic, helper functions, type utilities, and route handlers that are not extracted into service modules. The services directory (`functions/src/services/`) handles most database access and third-party clients, but the orchestration layer (state machine, handoff logic, message buffer processing) remains inlined in `index.ts`.

### In-Memory State Cache
The `conversationStates` Map in `index.ts` is module-level and therefore per-Cloud Run instance. Cloud Run may have multiple instances; state cached in one instance is not visible to another. The code falls back to Firestore on cache miss (`ensureConversationState`), and the Cloud Tasks buffering pattern serializes per-conversation processing, but the in-memory map is not a reliable cache across instances.

### `any` Type Usage
Several locations use `as any` casts (e.g., `req.rawBody`, Stripe event handling, subscription update). Some are necessary for untyped third-party response shapes; others appear to be pragmatic workarounds.

### Hardcoded Values in Source
- The ElevenLabs voice ID `7QQzpAyzlKTVrRzQJmTE` is hardcoded in `index.ts`
- The outbound caller number `+34911676990` appears as a default constant
- Stripe price IDs are hardcoded in the `STRIPE_PRICES` object as a fallback, with env var override
- The Twilio Verify Service SID comment mentions a current value (`VA97f3685ea340323d833e9f8c06d6657d`) — the actual value is in Secret Manager, but the comment exposes it

### Language Guardrail Feature Flags
`LANGUAGE_GUARDRAIL_ENABLED` and `LANGUAGE_GUARDRAIL_DRY_RUN` are controlled via the tracked env file. The dry-run flag allows testing the guardrail without enforcing it in production.

### Firestore Trigger Side Effects
The `onLeadWritten` trigger does more than audit logging: it enforces agent scope (`assignedAgentUid` reconciliation), applies AI-based listing qualification filters, and sends agent notification messages. These side effects are tightly coupled to the trigger.

### Error Handling Pattern
Most async error handling uses `try/catch` with `console.error` and a `res.status(500)` response. Alert-worthy errors send via `sendAlert`. Fail-open is explicit in some cases (e.g., listing filter errors proceed with notification rather than blocking).

### Test Architecture Tests
Several test files use a pattern of asserting regex patterns against the compiled JS source code of services (not calling the actual functions). This is a static structure test rather than a behavioral test, and the 9 failures indicate these assertions have drifted from the current implementation.

### Subscription Plan Logic
Plan ranks and base conversation counts are maintained in two places: `PLAN_RANKS` and `PLAN_BASE_CONVERSATIONS` constants in `index.ts`, and again in `subscriptionService.ts`. They must be kept in sync manually.

### Documented TODOs
There is one `TODO` comment in production code (`index.ts` line 1986): a note that Cloud API template SIDs cannot be fetched for the `callHandoffReadiness` endpoint in the same way as Twilio SIDs.

---

## 11. `.gitignore` Observations

The root `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`, and `.env.vapi`. However, `functions/.env.real-estate-idealista-bot` is **not listed** in `.gitignore` and is **tracked by git** (confirmed via `git ls-files`).

This file contains non-secret configuration values (SMTP host, Vapi resource IDs, Twilio template SIDs, feature flags, etc.). No secret key or token values were found in the file at time of audit. However:

1. The filename pattern `functions/.env.*` (Firebase's environment variable convention) implies it could be mistaken for a secret-bearing file by future contributors who add secrets to it
2. Any Twilio template SIDs (`TWILIO_TEMPLATE_SID_*`) in the file are resource identifiers, not credentials, but reveal internal service configuration
3. The `PROPLEAD_INTAKE_ORG_ID` value is present and reveals the Firestore document ID of the intake organization

If secrets are ever inadvertently added to this file, they would be committed to git history. Adding `functions/.env.*` to `.gitignore` (or at minimum `functions/.env.real-estate-idealista-bot`) and moving the values to Secret Manager or Firebase remote config would eliminate the risk surface.

The `functions/lib/` build output directory is correctly gitignored.

---

## 12. Open Questions and Glossary

### Open Questions

1. **Cloud Run service directory:** No `cloudrun/` directory was found in this repository. The previous context mentioned `cloudrun/brochure-pdf-service` and `cloudrun/slow-video-service`. These may be in a separate repository, or the directory may have been removed from this repo at some point.

2. **Propglow product scope:** The frontend has pages and components referencing Propglow (AI virtual staging), but the backend in `functions/src/index.ts` contains no Propglow-specific functions. Where does the Propglow image processing back-end live?

3. **`firestore.default.rules`:** The root directory contains both `firestore.rules` and `firestore.default.rules`. The second file is not referenced in `firebase.json`. Its relationship to the deployed rules is unclear.

4. **Calendly integration scope:** `functions/src/calendlyWebhook.ts` exists but no function export referencing it was found in `index.ts` during the audit. It may be exported under a name not yet mapped, or it may be an unused module.

5. **`scratch_check_db.ts`:** A file named `functions/src/scratch_check_db.ts` was listed in the directory. "Scratch" in the name suggests it may be a development/debugging file not intended for production. Its export status and whether it is referenced is not confirmed.

6. **Language guardrail `DRY_RUN` state:** `LANGUAGE_GUARDRAIL_DRY_RUN=false` in the tracked env file means the guardrail is active in production. The dry-run capability exists but is currently disabled.

7. **`VOICE_AUDIO_1_URL`:** The `VOICE_AUDIO_1_URL` `defineString` param is declared but its configured value was not observed in the tracked env file. If unset, the outbound consent voice system may fall back to a default or fail.

8. **Twilio Embedded Signup status per org:** The migration system supports moving orgs from a shared Twilio account to a dedicated subaccount. The current state of each org's migration is not centrally visible from the codebase.

### Glossary

| Term | Definition |
|---|---|
| **org / orgId** | A tenant organization. All data is scoped under `organizations/{orgId}/` in Firestore |
| **WABA** | WhatsApp Business Account — the Meta account that owns a WhatsApp Business phone number |
| **Lead** | A prospective buyer/tenant who has contacted a listing. Stored in `organizations/{orgId}/leads/{leadId}` |
| **Listing** | A real estate property listing. Stored in `organizations/{orgId}/listings/{listingId}`. Identified externally by `listingCode` |
| **listingCode** | The external property reference ID (e.g., Idealista listing ID) used to route inbound leads to the correct listing |
| **chatId** | Unique conversation identifier, typically `{phone}:{listingCode}` |
| **flowStep** | The current step in the deterministic conversation state machine for call-initiated flows |
| **qualification** | The open-ended GPT-4o-driven phase where the bot asks screening questions and marks the lead as qualified/rejected |
| **handoff** | The cross-org process by which a voice intake org transfers a lead to the listing owner's org for WhatsApp qualification |
| **buffer** | The 10-second Cloud Tasks delay window that aggregates multiple rapid inbound messages into a single processing batch |
| **processBufferedMessages** | The core bot orchestration function called by Cloud Tasks after the buffer window elapses |
| **template message** | A pre-approved WhatsApp message (Twilio Content API or Meta template) used when outside the 24-hour customer care window |
| **24-hour window** | WhatsApp Business Policy rule: free-form messages can only be sent within 24 hours of the customer's last message; otherwise a template is required |
| **credit / conversation** | The billing unit. One conversation = one lead qualification engagement. Balance tracked in `organizations/{orgId}/org_conversations` |
| **super_admin** | Platform-level administrator role. Has cross-org access and visibility |
| **owner** | Organization owner role. Full access to their org |
| **admin** | Organization administrator. Can manage team and settings within their org |
| **agent** | Sales agent. Scoped to listings they created or are assigned to |
| **member** | Read-only org member |
| **requestContext** | `AsyncLocalStorage` instance that carries `{ orgId }` through each request's async call chain |
| **seguimiento** | Spanish for "follow-up." The name of the scheduled reminder system for leads who haven't responded |
| **DTMF** | Dual-tone multi-frequency. The phone keypad tones used for consent capture in voice calls (caller presses "1") |
| **Embedded Signup** | Meta's flow for WhatsApp Business onboarding, combined with Twilio's Tech Provider flow to provision a per-org subaccount |
| **Idealista** | Major Spanish real estate listing portal. Source of inbound leads via Make.com webhooks |
| **Make.com** | Integration platform (formerly Integromat) used to relay Idealista form submissions to the `newLead` function |
| **ElevenLabs** | AI voice synthesis service used to generate personalized outbound consent call audio |
| **Vapi** | Voice AI platform used for voice conversation handling |
| **Propglow** | The AI virtual staging product (images/brochures) sharing the Firebase project |
| **Captaciones** | Spanish for "property acquisitions" — the `Captaciones` frontend page for tracking seller-side leads |
| **Cloud Tasks** | GCP service used to schedule delayed HTTP requests (message buffer tasks, name confirmation timeout tasks) |
| **PLAN_RANKS** | Ordered map of subscription plan IDs to numeric ranks used for upgrade/downgrade logic: `free=0, plus=1, pro=2, pro_plus=3` |
| **PLAN_BASE_CONVERSATIONS** | Conversations included per billing cycle per plan: `free=20, plus=80, pro=200, pro_plus=500` |
