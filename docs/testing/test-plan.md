# Proplead Test Plan

> Comprehensive manual test plan for the Proplead web app, Firebase backend, WhatsApp integrations, billing, and compliance surfaces.
>
> **Version:** 1.0 — 2026-05-28
> **Owner:** QA / Engineering
> **Status:** Living document — update on every PR that adds routes, cloud functions, or roles.

---

## 0. Introduction

### 0.1 Purpose

Proplead is a Spanish-language AI CRM for real-estate agents in Spain, with WhatsApp as the primary channel and Stripe-based billing. This document is the single source of truth for what must be tested before each release. It is intended for:

- QA engineers running release smoke + regression cycles.
- Engineers verifying their own changes before merge.
- Code reviewers verifying scope/coverage of changes.
- External reviewers (Meta App Review, security audits, compliance audits).

### 0.2 Scope

In scope:

- The React/TypeScript web app under `src/` (~32 routes).
- The Firebase Cloud Functions backend under `functions/src/` (50+ HTTPS + scheduled functions).
- WhatsApp providers: Twilio Tech Provider (default for embedded signup) **and** Meta Cloud API (admin-only fallback).
- Stripe billing (subscriptions, conversation top-ups, auto-recharge, billing portal).
- OpenAI-driven lead qualification, listing resolution, and language enforcement.
- Cross-org call handoff and voice/IVR flows.
- Firestore + Storage security rules and multi-tenant scoping.
- Email transactional notifications.
- Audit logging, GDPR data export, and Meta data deletion compliance.
- Mobile responsiveness (per `docs/mobile-audit-2026-05.md`).

Out of scope (tracked elsewhere):

- Automated test code (Playwright, Jest, Firestore-emulator suites).
- Load / stress testing methodology.
- Disaster recovery and backup runbooks.
- Internal product UX critique.

### 0.3 Test environment assumptions

Tests assume the following environments are available:

| Environment | Purpose | Notes |
| --- | --- | --- |
| `staging` Firebase project | All test cases by default | Real Twilio + Meta + Stripe **sandbox** keys; real Firestore but isolated org IDs |
| Local emulator suite | Firestore/Storage rules tests (`SEC`) | `firebase emulators:start --only firestore,storage,auth,functions` |
| Production | Smoke only — never destructive | Read-only verification of public routes, legal docs, status pages |

Test accounts (created once and reused):

- `owner+staging@proplead.io` — `owner` role
- `admin+staging@proplead.io` — `admin` role
- `member+staging@proplead.io` — `member` role
- `agent+staging@proplead.io` — `agent` role (single-listing scoped)
- `agent2+staging@proplead.io` — second agent in same org (cross-agent scoping)
- `superadmin+staging@proplead.io` — `super_admin` role
- `crossorg+staging@proplead.io` — owner of a separate org (cross-tenant tests)
- `inviteme+staging@proplead.io` — pristine account for invite acceptance tests

Test phones (E.164):

- `+34600000001` — primary tester WhatsApp (must be reachable on tester's device)
- `+34600000002` — secondary tester WhatsApp (for cross-tenant + opt-out tests)
- `+34600000003` — notification number for SMS verification (`NOTIF`)

Sandbox keys:

- Stripe test mode (use `4242 4242 4242 4242` for success, `4000 0000 0000 0341` for failed payment, `4000 0025 0000 3155` for SCA challenge).
- Twilio test credentials + WhatsApp sandbox sender for non-template sends.
- Meta WABA in development mode with the tester's phone allowlisted.

### 0.4 Reading a test case

```
### TC-{AREA}-{NNN}: {short title}

**Priority:** P0 | P1 | P2
**Roles:** owner | admin | member | agent | super_admin | unauthenticated
**Preconditions:** {state required before running}

**Steps:**
1. ...
2. ...

**Expected result:**
- ...

**Notes:** {edge cases, related TCs, known issues}
```

**Priority scheme:**

- **P0** — Blockers: money flows, auth, security/RLS, message send/receive, qualified-lead notification routing, data-loss risks, GDPR compliance.
- **P1** — Important user flows: CRUD on leads/listings/team, dashboard metrics, onboarding completion, filters and search, plan changes.
- **P2** — Cosmetic, niche admin tooling, internal labs, smoke checks.

### 0.5 Filing bugs

When a test case fails, file an issue with:

- Test case ID (e.g. `TC-AUTH-007`).
- Environment (staging / emulator / prod).
- Role / test account used.
- Expected vs actual.
- Screenshots / video for UI bugs; `gcloud functions logs read <fn>` excerpts for backend bugs.
- Firestore document path for data-corruption bugs.

### 0.6 Glossary

- **org / orgId** — Top-level tenant. All data lives under `organizations/{orgId}/...` in Firestore.
- **chatId** — WhatsApp chat identifier (`<E.164>@s.whatsapp.net` or `@c.us`). **Not org-scoped**: the same phone can be a lead under multiple agencies; org scoping is by Firestore path + `requestContext.orgId`, not chatId ownership.
- **WABA** — WhatsApp Business Account (Meta).
- **Tech Provider** — Twilio acting as WhatsApp BSP; default path for embedded signup.
- **Cloud API** — Meta's direct WhatsApp Business Cloud API; admin-only fallback.
- **Qualified lead** — Lead whose `qualificationStatus = "qualified"`. Triggers notification to the listing's selected notification numbers.
- **Handoff** — Transfer of an inbound call from the global intake WABA to a specific tenant org's WABA, after listing/agent identification.
- **24h customer-care window** — WhatsApp restriction: free-form messages can only be sent within 24h of the last inbound user message. Outside the window, only approved templates are allowed.
- **Initial outbound** — The first agent/bot message in a new conversation. Always charges 1 credit (`CREDITS_PER_INITIAL_OUTBOUND`).
- **Impersonation** — Super-admin feature that lets the operator view another user's state read-only. Stored in React state only (never localStorage).

### 0.7 Cross-references

- [`docs/mobile-audit-2026-05.md`](../mobile-audit-2026-05.md) — Mobile responsiveness issue catalog (drives `MOBI` section).
- [`docs/meta-app-review-plan.md`](../meta-app-review-plan.md) — Meta App Review preparation runbook.
- [`docs/two-stage-call-handoff-status.md`](../two-stage-call-handoff-status.md) — Call handoff feature status.
- [`docs/per-org-template-cutover-runbook.md`](../per-org-template-cutover-runbook.md) — Twilio template migration runbook.
- `BRAND.md` (repo root) — Visual brand guidelines.
- `firestore.rules`, `storage.rules` — Authoritative security rules.

---

## Table of contents

1. [Authentication & Authorization (`AUTH`)](#1-authentication--authorization-auth)
2. [Onboarding (`ONB`)](#2-onboarding-onb)
3. [Marketing & Public Pages (`LAND`)](#3-marketing--public-pages-land)
4. [Dashboard (`DASH`)](#4-dashboard-dash)
5. [Listings (`LIST`)](#5-listings-list)
6. [Leads (`LEAD`)](#6-leads-lead)
7. [Conversations (`CONV`)](#7-conversations-conv)
8. [Organization & Team (`ORG`)](#8-organization--team-org)
9. [Configuration (`CFG`)](#9-configuration-cfg)
10. [Subscription & Billing (`SUB`)](#10-subscription--billing-sub)
11. [Usage Analytics (`USE`)](#11-usage-analytics-use)
12. [Alerts & Monitoring (`ALRT`)](#12-alerts--monitoring-alrt)
13. [Audit Log (`AUD`)](#13-audit-log-aud)
14. [WhatsApp Integration (`WA`)](#14-whatsapp-integration-wa)
15. [Cross-Org Call Handoff (`CALL`)](#15-cross-org-call-handoff-call)
16. [AI / OpenAI Features (`AI`)](#16-ai--openai-features-ai)
17. [Email & Notifications (`EMAIL`)](#17-email--notifications-email)
18. [Legal & Compliance (`LEGAL`)](#18-legal--compliance-legal)
19. [Internal / Lab & Admin Pages (`ADMIN`)](#19-internal--lab--admin-pages-admin)
20. [Twilio Sender Migration (`MIG`)](#20-twilio-sender-migration-mig)
21. [Notification Numbers Verification (`NOTIF`)](#21-notification-numbers-verification-notif)
22. [Mobile Responsiveness (`MOBI`)](#22-mobile-responsiveness-mobi)
23. [Security & Access Control (`SEC`)](#23-security--access-control-sec)
24. [Performance & Real-time (`PERF`)](#24-performance--real-time-perf)
25. [Document maintenance](#25-document-maintenance)

---

## 1. Authentication & Authorization (`AUTH`)

Covers `src/pages/Login.tsx`, `src/pages/Signup` (and invitation variant), `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/EmailPreferences.tsx`, and `src/contexts/AuthContext.tsx`. Five roles in play: `owner`, `admin`, `member`, `agent`, `super_admin`.

### TC-AUTH-001: Email/password signup happy path

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Email `newuser+{epoch}@proplead.test` does not exist.

**Steps:**
1. Navigate to `/signup`.
2. Fill Name, Email, Password (≥8 chars).
3. Tick the **legal consent** checkbox.
4. Leave the **marketing consent** checkbox unticked.
5. Submit.

**Expected result:**
- Firebase Auth user created.
- `userConsents/{uid}` doc written with versions `terms: "1.0"`, `privacy: "1.0"`, `dpa: "1.0"` and `marketing: false`.
- `bootstrapUserOrganization` runs; new org doc exists at `organizations/{orgId}`.
- Welcome email arrives at the address (`sendWelcomeNotification`).
- New-signup admin alert email arrives at the Proplead admin inbox (`sendNewSignupAlertEmail`).
- User is redirected to `/onboarding` step 1.

**Notes:** Capture screenshots of the welcome email + admin alert for the release notes.

### TC-AUTH-002: Signup blocks when legal consent unchecked

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** —

**Steps:**
1. Navigate to `/signup`.
2. Fill all fields.
3. Leave **legal consent** unchecked.
4. Click Submit.

**Expected result:**
- Submit button is disabled, or form shows inline error: *"Debes aceptar los términos para continuar."*
- No Firebase user is created.
- No `userConsents` doc is written.

### TC-AUTH-003: Signup rejects duplicate email

**Priority:** P1
**Roles:** unauthenticated
**Preconditions:** A user with email `owner+staging@proplead.io` exists.

**Steps:**
1. Navigate to `/signup`.
2. Use the existing email.
3. Submit.

**Expected result:**
- Form shows error mapped from Firebase `auth/email-already-in-use`, in Spanish (e.g. *"Ya existe una cuenta con este correo"*).
- No new user created.

### TC-AUTH-004: Google sign-in for new user creates org

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Google account `newgoogle+{epoch}@gmail.com` has not been used.

**Steps:**
1. Navigate to `/login`.
2. Click **Continuar con Google**.
3. Complete the Google popup with the test account.

**Expected result:**
- Firebase Auth user created with `providerId: google.com`.
- `bootstrapUserOrganization` creates new org.
- `userConsents` doc captured at signup with default versions.
- User lands on `/onboarding`.

### TC-AUTH-005: Sign-in happy path

**Priority:** P0
**Roles:** owner, admin, member, agent, super_admin
**Preconditions:** Test account exists.

**Steps:**
1. Navigate to `/login`.
2. Enter the test account's email + password.
3. Submit.

**Expected result:**
- AuthContext populates `user`, `organizationId`, `role`, `effectiveRole`, `availableOrganizations`.
- Default landing is `/dashboard` (or `/onboarding` if onboarding incomplete).
- Sidebar nav reflects role (see TC-AUTH-021 through TC-AUTH-025).

### TC-AUTH-006: Sign-in rejects wrong password

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** —

**Steps:**
1. Navigate to `/login`.
2. Use a real email with wrong password.
3. Submit.

**Expected result:**
- Spanish error message displayed (e.g. *"Correo o contraseña incorrectos"*).
- No info leakage about whether the email exists.
- After 5 failed attempts in 30s, Firebase enforces rate-limit; surface that as a separate Spanish message.

### TC-AUTH-007: Sign-in handles unknown email

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Navigate to `/login`.
2. Enter `doesnotexist+{epoch}@proplead.test` and any password.
3. Submit.

**Expected result:**
- Same generic error as wrong-password (do not reveal account existence).

### TC-AUTH-008: Sign-in network error

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Block requests to `*.googleapis.com` via DevTools network override.
2. Attempt sign-in.

**Expected result:**
- User-facing toast or inline error: *"Error de conexión. Inténtalo de nuevo."*
- No console exception leaked to user.

### TC-AUTH-009: Forgot password request

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Test account exists.

**Steps:**
1. Navigate to `/forgot-password`.
2. Enter test account email.
3. Submit.

**Expected result:**
- `passwordResetRequest` cloud function invoked.
- Password reset email arrives within 30s with link of the form `/reset-password?oobCode=…`.
- Page shows success notice: *"Te hemos enviado un correo…"*.

### TC-AUTH-010: Forgot password unknown email

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Navigate to `/forgot-password`.
2. Enter a non-existent email.
3. Submit.

**Expected result:**
- Same success notice as a real email (do not reveal existence).
- No email sent.
- Backend logs the no-op without raising.

### TC-AUTH-011: Reset password with valid oobCode

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Forgot-password email triggered in TC-AUTH-009.

**Steps:**
1. Click the reset link.
2. Enter a new password ≥8 chars; confirm.
3. Submit.

**Expected result:**
- Password updated via Firebase Auth.
- Redirect to `/login` with success toast.
- Old password no longer works (TC-AUTH-006 with old password should fail).

### TC-AUTH-012: Reset password rejects expired/invalid oobCode

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/reset-password?oobCode=invalid123`.

**Expected result:**
- Spanish error: *"El enlace ha caducado o no es válido. Solicita uno nuevo."*
- Form disabled or redirects back to `/forgot-password`.

### TC-AUTH-013: Reset password requires matching confirmation

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Open a valid reset link.
2. Enter different values in password + confirmation fields.

**Expected result:**
- Inline error indicates passwords don't match.
- Submit disabled until they match.

### TC-AUTH-014: Team invitation acceptance — happy path

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Admin invited `inviteme+staging@proplead.io` as `agent` via `sendInvitation`; invite is unused and not expired.

**Steps:**
1. Open the link `/invite?token={inviteToken}`.
2. Confirm the displayed preview shows org name, inviter, role `agent`, and the email field is pre-filled.
3. Set a password and submit.

**Expected result:**
- `acceptInvitation` cloud function called.
- Firebase Auth user created; user joins the invited org with `agent` role.
- Invitation doc marked `acceptedAt: <Timestamp>`.
- Redirect to `/dashboard` or onboarding if applicable.

### TC-AUTH-015: Invitation token expired

**Priority:** P1
**Roles:** unauthenticated
**Preconditions:** Invitation `expiresAt` is in the past.

**Steps:**
1. Open invite link.

**Expected result:**
- Page shows expired-state UI in Spanish (*"Esta invitación ha caducado"*) and a CTA to ask the admin for a new one.
- No account is created.

### TC-AUTH-016: Invitation token already used

**Priority:** P1
**Roles:** unauthenticated
**Preconditions:** Invitation has `acceptedAt` set.

**Steps:**
1. Reopen the invite link.

**Expected result:**
- Page shows used-state UI in Spanish and a link to `/login`.

### TC-AUTH-017: Invitation token does not exist

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Open `/invite?token=garbage`.

**Expected result:**
- Generic Spanish error: *"Invitación no encontrada"*.
- No PII leaked.

### TC-AUTH-018: Email preferences — unsubscribe via signed token

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Recipient `marketing-on@proplead.test` has communications enabled.

**Steps:**
1. Open `/email-preferences?t={signedToken}`.
2. Click **Darme de baja**.

**Expected result:**
- `emailPreferencesApi` records the user as unsubscribed.
- Subsequent low-balance / marketing emails do not deliver.
- Page shows confirmation: *"Te has dado de baja…"*.

### TC-AUTH-019: Email preferences — resubscribe

**Priority:** P1
**Roles:** unauthenticated
**Preconditions:** Recipient previously unsubscribed (TC-AUTH-018).

**Steps:**
1. Open the same preferences link.
2. Click **Volver a suscribirme**.

**Expected result:**
- User re-enabled; transactional emails resume immediately.
- Future marketing emails resume next campaign.

### TC-AUTH-020: Email preferences with tampered token

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/email-preferences?t={tampered}` where the HMAC has been modified.

**Expected result:**
- Backend returns 400/401.
- UI shows generic Spanish error and does not toggle any preference.

### TC-AUTH-021: Role-based route gating — `owner` matrix

**Priority:** P0
**Roles:** owner
**Preconditions:** Owner is signed in.

**Steps:** Visit each of the following routes and confirm access:
- `/dashboard`, `/anuncios`, `/leads`, `/conversaciones`, `/configuracion`, `/onboarding`, `/connect-whatsapp`, `/organizacion`, `/suscripcion`, `/uso`, `/usuarios`, `/admin/twilio-migration`, `/alertas`, `/historial`.

Then visit super-admin-only routes and confirm denial:
- `/onboards`, `/admin/tools`.

**Expected result:**
- All owner-permitted routes render normally.
- Super-admin-only routes redirect to `/dashboard` or show an "unauthorised" view.

### TC-AUTH-022: Role-based route gating — `admin` matrix

**Priority:** P0
**Roles:** admin

**Steps:** Same as TC-AUTH-021 but as `admin`. Admin has access to `/admin/twilio-migration` but NOT to `/uso` and `/usuarios` unless the rule grants it. Refer to `src/App.tsx` to confirm current allowlist.

**Expected result:**
- Admin sees all org-management routes.
- Admin denied super-admin-only routes.
- `/uso` and `/usuarios` accessible to admin per the route table; record any drift.

### TC-AUTH-023: Role-based route gating — `member` matrix

**Priority:** P0
**Roles:** member

**Expected result:**
- Member has read-mostly access to `/dashboard`, `/anuncios`, `/leads`, `/conversaciones`, `/suscripcion` (read), `/organizacion` (read).
- Member denied `/uso`, `/usuarios`, `/admin/*`, `/onboards`.

### TC-AUTH-024: Role-based route gating — `agent` matrix

**Priority:** P0
**Roles:** agent

**Expected result:**
- Agent sees `/dashboard`, `/anuncios` (own listings only), `/leads` (own scope), `/conversaciones` (own scope).
- Agent denied `/uso`, `/usuarios`, `/admin/*`, `/onboards`, `/configuracion`.

### TC-AUTH-025: Role-based route gating — `super_admin` matrix

**Priority:** P0
**Roles:** super_admin

**Expected result:**
- Super-admin sees every route, including `/onboards`, `/admin/tools`, `/admin/twilio-migration`, `/botTest`, `/_internal/whatsapp-animation-lab`, `/_internal/whatsapp-leads-animation`, `/fonts`, `/email-templates`.

### TC-AUTH-026: Unauthenticated access redirects to /login

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. While signed out, visit `/dashboard`, `/leads`, `/conversaciones`, `/anuncios`, `/organizacion`, `/configuracion`, `/suscripcion`, `/uso`.

**Expected result:**
- Each redirects to `/login` and preserves the intended path (so post-login we land back there).

### TC-AUTH-027: Organization switching for multi-org user

**Priority:** P0
**Roles:** owner (member of two orgs)
**Preconditions:** Test account belongs to Org A and Org B.

**Steps:**
1. Sign in.
2. Open the org switcher in the sidebar.
3. Switch from Org A → Org B.

**Expected result:**
- `switchOrganization` updates AuthContext.
- All page data reloads scoped to Org B (listings, leads, conversations differ).
- No data from Org A is visible.
- Refreshing the page keeps Org B selected for the session (state-only, may reset on hard reload — record actual behavior).

### TC-AUTH-028: Impersonation start by super_admin

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Sign in as super-admin.
2. Navigate to `/usuarios` or `/organizacion`.
3. Click **Impersonar** on a target user.

**Expected result:**
- AuthContext sets `impersonation: { startedAt, originalUid, originalRole }`.
- `effectiveRole`, `effectiveUid`, `organizationId` switch to target's.
- `isImpersonationReadOnly` is `true`.
- Layout displays a persistent banner showing impersonated user with **Salir de impersonación** button.
- An audit log entry is written (action: impersonation_started, with original UID).

### TC-AUTH-029: Impersonation enforces read-only

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:** While impersonating, attempt each of:
- Edit a lead (`TC-LEAD-*`).
- Toggle bot enabled/disabled on a conversation.
- Activate/deactivate a listing.
- Change org details.
- Send a manual WhatsApp message.

**Expected result:**
- Every write action is blocked at the UI (buttons disabled or toast: *"No se permite modificar en modo soporte"*).
- If the request reaches the server (DevTools forcing a call), Firestore rules / cloud-function checks reject the write.

### TC-AUTH-030: Impersonation clears cleanly

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. While impersonating, click **Salir de impersonación**.

**Expected result:**
- AuthContext reverts to original UID/role/org.
- Read-only flag false.
- Audit log entry written (action: impersonation_ended).
- No impersonation data left in `localStorage` (XSS-safe).

### TC-AUTH-031: Sign-out clears all state

**Priority:** P0
**Roles:** any signed-in

**Steps:**
1. Click sign-out from the user menu.

**Expected result:**
- AuthContext cleared; `user` is null.
- Redirect to `/login`.
- `localStorage` keys for column visibility (`leads-columns`) remain, but no auth tokens.
- Re-attempting a protected route redirects to login (TC-AUTH-026).

### TC-AUTH-032: Checkout intent recovery after auth refresh

**Priority:** P0
**Roles:** owner

**Steps:**
1. Sign in.
2. From `/suscripcion`, click **Comprar pack**; in the Stripe checkout, do NOT complete the payment — close the tab.
3. Return to `/dashboard`.

**Expected result:**
- A banner / modal appears indicating a pending checkout, with a **Reanudar** CTA.
- Clicking **Reanudar** routes back to a fresh Stripe checkout session for the same intent.

### TC-AUTH-033: Session expiry forces re-auth

**Priority:** P1
**Roles:** owner

**Steps:**
1. Sign in.
2. In DevTools, clear Firebase Auth `IndexedDB` / cookies.
3. Trigger a write (e.g. edit a lead).

**Expected result:**
- Write fails with 401.
- App routes to `/login`.
- After re-signing-in, app returns to the previous route.

### TC-AUTH-034: Cannot change role via `/users/{uid}` write

**Priority:** P0
**Roles:** any non-super-admin

**Steps:**
1. While signed in as `member`, attempt to write `users/{ownUid}.role = "owner"` via the Firebase Web SDK in DevTools console.

**Expected result:**
- Firestore rules reject the update.
- Role remains unchanged.

### TC-AUTH-035: Auth state survives full page reload

**Priority:** P1
**Roles:** owner

**Steps:**
1. Sign in.
2. Hard refresh (Cmd+Shift+R).

**Expected result:**
- AuthContext re-populates from Firebase Auth session.
- Same route reloads without bouncing to `/login`.
- Org/role unchanged.

---

## 2. Onboarding (`ONB`)

Covers `src/pages/Onboarding.tsx`, `src/pages/ConnectWhatsApp.tsx`, `src/services/embeddedSignup.ts`, and the cloud functions `exchangeEmbeddedSignupCode`, `getEmbeddedSignupConfig`, `setManualCloudApiConfig`, plus the Twilio onboarding path (`twilioOnboarding.ts`).

### TC-ONB-001: New owner lands on onboarding step 1

**Priority:** P0
**Roles:** owner (fresh signup)
**Preconditions:** Newly created org from TC-AUTH-001.

**Steps:**
1. Land on `/onboarding`.

**Expected result:**
- Step indicator shows step 1 of 7 active.
- WhatsApp connection check tile is in "not connected" state with CTA *"Conectar WhatsApp"*.

### TC-ONB-002: ConnectWhatsApp — Twilio Tech Provider happy path

**Priority:** P0
**Roles:** owner
**Preconditions:** Org has no `botConfig.twilioConfig` yet.

**Steps:**
1. From step 1, click **Conectar WhatsApp**.
2. Follow the Twilio Tech Provider onboarding flow (`onboardTwilioTechProviderSender`): create subaccount → create sender → wait for ACTIVE → clone templates → configure webhook.
3. Wait for completion banner.

**Expected result:**
- Org's `botConfig.twilioConfig` populated with subaccount SID, sender SID, WABA ID, phone number.
- Templates cloned from `PROPLEAD_TEMPLATE_SOURCE_ORG` and submitted for Meta approval (status `pending`).
- Webhook URL configured on the sender.
- Onboarding advances from step 1 → 2.
- `trackWhatsappConnectStarted('twilio')` and `trackWhatsappConnected('twilio')` fire (verify in analytics dashboard or DevTools network).

### TC-ONB-003: ConnectWhatsApp — Meta Cloud API embedded signup (admin fallback)

**Priority:** P1
**Roles:** super_admin or admin (whichever can opt into Cloud API)

**Steps:**
1. From the admin tools / connect-whatsapp page, choose **Cloud API**.
2. Click **Continuar con Facebook**.
3. In the Meta popup: log in, select WABA, select phone number, grant permissions.
4. Confirm Meta callback `exchangeEmbeddedSignupCode` runs.

**Expected result:**
- Access token stored in GCP Secret Manager (verify secret name in `botConfig.cloudApiConfig.accessTokenSecretName`).
- `botConfig.cloudApiConfig` populated with `phoneNumberId`, `wabaId`, `verifyToken`, `displayPhoneNumber`, `graphApiVersion`.
- App subscribed to WABA webhooks (`subscribeAppToWaba`).
- Onboarding advances.
- `trackWhatsappConnected('cloud_api')` fires.

### TC-ONB-004: WhatsApp connection failure — Facebook popup closed

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Conectar WhatsApp**.
2. Close the Facebook popup before completing.

**Expected result:**
- Error toast: *"No se completó la conexión con WhatsApp. Inténtalo de nuevo."*
- No partial config stored.
- User remains on step 1.

### TC-ONB-005: Agency details step

**Priority:** P0
**Roles:** owner
**Preconditions:** Step 2 active.

**Steps:**
1. Fill `agencyName`, `legalName` (optional), `taxId`, `address`, `employeesCount`, optional `contactPhone`, optional `website`.
2. Continue.

**Expected result:**
- `organizations/{orgId}/settings` (or `organizations/{orgId}` root) updated with values.
- Onboarding advances to step 3 (assistant setup).

### TC-ONB-006: Agency details validation — empty required field

**Priority:** P1
**Roles:** owner

**Steps:**
1. Leave `agencyName` blank; press Continue.

**Expected result:**
- Inline Spanish error: *"El nombre de la agencia es obligatorio"*.
- Submit disabled until filled.

### TC-ONB-007: Assistant setup — preset avatar + tone

**Priority:** P0
**Roles:** owner
**Preconditions:** Step 3 active.

**Steps:**
1. Select a preset avatar from `src/constants/assistantAvatars.ts`.
2. Pick a tone (e.g. *Amable*, *Profesional*).
3. Enter assistant name (e.g. *María*).
4. Continue.

**Expected result:**
- `botConfig.cloudApiConfig.assistantAvatarId` (and Twilio equivalent) stored.
- Public avatar URL written via `buildAvatarPublicUrl`.
- `assistantName` stored in org settings.

### TC-ONB-008: Assistant setup — custom photo upload

**Priority:** P1
**Roles:** owner

**Steps:**
1. From step 3, click **Subir foto personalizada**.
2. Upload a JPEG ≤5 MiB.
3. Wait for upload completion.

**Expected result:**
- File lands under `organizations/{orgId}/assistant-photo/{filename}`.
- Storage rule check passes (image type + ≤5 MiB).
- `assistantPhotoUrl` stored in org settings.
- WABA profile photo updated via `setWhatsAppProfilePhoto`.

### TC-ONB-009: Assistant photo — reject file over size

**Priority:** P1
**Roles:** owner

**Steps:**
1. Try to upload a 6 MiB image.

**Expected result:**
- Storage rule rejects; user sees Spanish error: *"La imagen debe ser menor a 5 MB"*.

### TC-ONB-010: Assistant photo — reject wrong MIME

**Priority:** P1
**Roles:** owner

**Steps:**
1. Try to upload a `.pdf` or `.gif`.

**Expected result:**
- Storage rule rejects; user sees Spanish error: *"Solo se permiten archivos JPG o PNG"*.

### TC-ONB-011: Display name confirmation step

**Priority:** P1
**Roles:** owner

**Steps:**
1. On step 4, confirm or edit the assistant display name.

**Expected result:**
- Final name shown to leads matches what's stored.
- Advances to step 5.

### TC-ONB-012: Forwarding email step

**Priority:** P1
**Roles:** owner

**Steps:**
1. Enter a notification forwarding email.
2. Continue.

**Expected result:**
- Forwarding email stored; subsequent qualified-lead notifications also email this address.
- Invalid email shows Spanish inline error.

### TC-ONB-013: Phone verification via Twilio Verify (v2)

**Priority:** P0
**Roles:** owner
**Preconditions:** v2 verification feature flag on; tester has access to test SMS number.

**Steps:**
1. Add a notification number `+34600000003`.
2. Click **Enviar código**.
3. Receive SMS within 30s.
4. Enter the OTP.

**Expected result:**
- `startNotificationNumberVerification` called.
- Twilio Verify sends SMS.
- `checkNotificationNumberVerification` validates code.
- Firestore doc `organizations/{orgId}/notificationNumbers/{numberId}` set to `verified: true`, `verificationStatus: "approved"`.

### TC-ONB-014: Phone verification — wrong code

**Priority:** P1
**Roles:** owner

**Steps:**
1. Trigger verification.
2. Enter `000000`.

**Expected result:**
- Spanish error: *"Código incorrecto. Te quedan N intentos."*
- `verificationAttempts` counter increments.

### TC-ONB-015: Phone verification — rate limit

**Priority:** P1
**Roles:** owner

**Steps:**
1. Trigger verification 5+ times in 60s for the same number.

**Expected result:**
- Twilio Verify returns rate-limit; UI shows Spanish error indicating to wait.
- `isTwilioVerifyRateLimited` triggers the rate-limit branch.

### TC-ONB-016: Phone verification — expired code

**Priority:** P2
**Roles:** owner

**Steps:**
1. Trigger verification.
2. Wait >10 minutes.
3. Enter the original OTP.

**Expected result:**
- Backend returns expired error; UI shows Spanish *"El código ha caducado. Solicita uno nuevo."*

### TC-ONB-017: CalEu inline embed renders

**Priority:** P2
**Roles:** owner

**Steps:**
1. Reach the onboarding step that embeds CalEu.
2. Wait for iframe to load.

**Expected result:**
- `src/components/CalEuInlineEmbed.tsx` renders an iframe with the booking widget.
- Booking a slot triggers Calendly webhook (`CALENDLY_WEBHOOK_SIGNING_KEY`), but this can be confirmed separately.

### TC-ONB-018: Onboarding step persistence across refresh

**Priority:** P0
**Roles:** owner

**Steps:**
1. Reach step 4.
2. Hard refresh.

**Expected result:**
- Onboarding lands back on step 4 (read from `organizationSettings.onboardingStep`).
- No data loss in previously filled steps.

### TC-ONB-019: Back/forward navigation between completed steps

**Priority:** P2
**Roles:** owner

**Steps:**
1. From a later step, navigate to a previously completed step (e.g. step 2 → review).

**Expected result:**
- Earlier step opens read-only or editable per design.
- Saving from a previous step does not regress the onboardingStep pointer.

### TC-ONB-020: Onboarding completion redirects to dashboard

**Priority:** P0
**Roles:** owner

**Steps:**
1. Complete all 7 steps.

**Expected result:**
- `organizationSettings.onboardingStep` set to completed value (e.g. `7` or `done`).
- Sidebar no longer shows **Onboarding** item (or shows it as completed).
- Auto-redirect to `/dashboard` on next session.

### TC-ONB-021: Onboarding aware of plan tier

**Priority:** P1
**Roles:** owner
**Preconditions:** Two test orgs on different plans (`free` and `pro_plus`).

**Steps:**
1. Run onboarding as `free` plan user — confirm only 1 notification number max.
2. Run onboarding as `pro_plus` plan user — confirm multi-number allowance.

**Expected result:**
- `getMaxListingNotificationNumbers(planId)` is respected in onboarding UI.

### TC-ONB-022: Onboarding read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating an unfinished onboarding user)

**Steps:**
1. Impersonate a user mid-onboarding.
2. Try to advance a step.

**Expected result:**
- All advance/save buttons disabled.
- Banner explains read-only mode.

---

## 3. Marketing & Public Pages (`LAND`)

Covers `src/pages/MarketingLandingV2.tsx`, the legacy landing variant, `src/pages/LegalDoc.tsx`, the public DeletionStatus page, and the cookies/legal route table.

### TC-LAND-001: MarketingLandingV2 renders all sections

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/` in a fresh incognito window at 1440×900.

**Expected result:**
- Hero, value props, plan showcase, feature animations, FAQ accordion, integrations row (Idealista, Fotocasa, Pisos.com), footer all render.
- No console errors.
- Page weight + Lighthouse score acceptable (record baseline).

### TC-LAND-002: Hero CTA routes to signup

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Click **Prueba gratis** (or equivalent primary CTA) in the hero.

**Expected result:**
- Routes to `/signup`.
- Analytics fires a CTA-click event.

### TC-LAND-003: Plan tier cards link to signup with intent

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Click each plan tier (free, plus, pro, pro_plus) CTA.

**Expected result:**
- Each routes to `/signup` (or `/suscripcion` post-signup) with the right plan intent captured (query param or in-memory).

### TC-LAND-004: FAQ accordion toggles

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Click each FAQ item header.

**Expected result:**
- Item expands, others collapse (or stay open per design).
- Keyboard accessible (Enter/Space).

### TC-LAND-005: Integration logos visible

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Scroll to the integrations row.

**Expected result:**
- Idealista, Fotocasa, Pisos.com logos render at correct aspect ratio, all `alt` attributes present.

### TC-LAND-006: Legacy landing `/landingv2`

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Open `/landingv2`.

**Expected result:**
- Legacy landing renders (or redirects if removed).
- No 404.

### TC-LAND-007: Legal route — Terms

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/terms`.

**Expected result:**
- Markdown → HTML conversion renders T&C.
- Auto-generated TOC visible.
- Language is Spanish, version stamp matches `LEGAL_VERSIONS.terms`.

### TC-LAND-008: Legal route — Privacy Policy

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/privacy-policy`.

**Expected result:**
- Renders privacy policy; references `soporte@proplead.io` per [[project_legal_stack_v1]].

### TC-LAND-009: Legal route — DPA

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/dpa`.

**Expected result:**
- Renders DPA (Data Processing Agreement).
- Mentions UK entity, England & Wales law.

### TC-LAND-010: Legal route — Cookies

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/cookies`.

**Expected result:**
- Renders cookies policy (es).
- Lists GA4, Meta Pixel, Google Ads tags per [[project_legal_stack_v1]].

### TC-LAND-011: Legal route — AUP

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/aup`.

**Expected result:**
- Renders Acceptable Use Policy.

### TC-LAND-012: Legal route — Data Deletion

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/data-deletion`.

**Expected result:**
- Renders instructions for Meta data-deletion requests; references support email.

### TC-LAND-013: Legal route — Aviso Legal

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/aviso-legal` (and `/aviso.es.md` if served).

**Expected result:**
- Renders Spanish legal notice required by Spanish law.

### TC-LAND-014: Legal docs have anchor TOC

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. On any legal doc, click a TOC entry.

**Expected result:**
- Scrolls to the corresponding heading; URL updates with `#anchor`.
- Sharing the anchored URL re-scrolls on load.

### TC-LAND-015: DeletionStatus page resolves valid code

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** A `dataDeletionRequests/{code}` doc exists with status `pending`.

**Steps:**
1. Open `/legal/deletion-status?code={code}`.

**Expected result:**
- Page renders current status (`pending`, `processing`, `deleted`).
- After `purgeDeletedOrganizations` runs, status moves to `deleted`.

### TC-LAND-016: DeletionStatus invalid code

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Open `/legal/deletion-status?code=invalid`.

**Expected result:**
- Page shows Spanish *"Solicitud no encontrada"*; no data leakage.

### TC-LAND-017: Forgot password flow accessible from login

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. On `/login`, click **¿Olvidaste tu contraseña?**.

**Expected result:**
- Routes to `/forgot-password`.

### TC-LAND-018: Cookie banner — consent mode v2

**Priority:** P0
**Roles:** unauthenticated
**Preconditions:** Clear cookies for proplead.io.

**Steps:**
1. Open `/`.
2. Inspect the cookie banner.
3. Click **Configurar** (or equivalent).
4. Toggle marketing/analytics off.
5. Save.

**Expected result:**
- GA4 / Meta Pixel / Google Ads tags do NOT fire until consented.
- `gtag('consent', 'update', {...})` calls reflect choices in Network/Console.
- Choice persists in a cookie or localStorage.

### TC-LAND-019: Cookie banner — accept all

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Click **Aceptar todo**.

**Expected result:**
- All analytics tags fire on subsequent navigation.

### TC-LAND-020: Cookie banner — reject all

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Click **Rechazar todo**.

**Expected result:**
- Only essential cookies set; no GA4 / Meta / Google Ads requests in Network tab.

### TC-LAND-021: Mobile landing — hero clip (known P0)

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/` at 375×667 viewport.

**Expected result (when bug is fixed):**
- Hero h1 "desinteresados" does NOT clip the viewport edge.

**Notes:** Currently P0 in mobile audit; treat as a known failure until fixed.

### TC-LAND-022: SEO meta tags present

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. View page source of `/`.

**Expected result:**
- `<title>`, `<meta name="description">`, OpenGraph tags, `<link rel="canonical">` all populated.
- `lang="es"` on `<html>`.

---

## 4. Dashboard (`DASH`)

Covers `src/pages/Dashboard.tsx`. Renders KPI tiles, date filters, listing filter, and conversation balance, all backed by real-time Firestore listeners scoped to `organizationId` and role.

### TC-DASH-001: KPI tiles render with data

**Priority:** P0
**Roles:** owner / admin
**Preconditions:** Org has ≥1 active listing, ≥1 lead, ≥1 conversation, ≥1 qualified lead.

**Steps:**
1. Open `/dashboard`.

**Expected result:**
- Tiles show non-zero counts for *Anuncios activos*, *Total leads*, *Conversaciones*, *Leads cualificados*, *Saldo de conversaciones*.
- Each count matches direct Firestore counts (verify via Firebase console).

### TC-DASH-002: Empty state for new org

**Priority:** P1
**Roles:** owner (fresh org)

**Steps:**
1. Open `/dashboard` immediately after onboarding.

**Expected result:**
- All counters show `0` with neutral copy (no error).
- Suggested CTAs visible: *Crear primer anuncio*, *Conectar WhatsApp* if not connected.

### TC-DASH-003: Date filter — today

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select **Hoy** in the date selector.

**Expected result:**
- Counters update to today's window only.
- Network shows new Firestore queries with proper `where` clauses on `createdAt`.

### TC-DASH-004: Date filter — yesterday

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select **Ayer**.

**Expected result:**
- Counters reflect the 24-hour window from yesterday 00:00 to today 00:00 (local TZ).

### TC-DASH-005: Date filter — last 7 days

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select **Últimos 7 días**.

**Expected result:**
- Counters reflect the rolling 7-day window.

### TC-DASH-006: Date filter — last 30 days

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select **Últimos 30 días**.

**Expected result:**
- Counters reflect the rolling 30-day window.

### TC-DASH-007: Date filter — custom range

**Priority:** P1
**Roles:** owner

**Steps:**
1. Pick a custom range covering exactly one known qualified-lead creation date.

**Expected result:**
- *Leads cualificados* tile equals 1.
- Range persists when navigating to `/leads` if URL state is shared (record actual behavior).

### TC-DASH-008: Listing filter dropdown

**Priority:** P1
**Roles:** owner

**Steps:**
1. Pick a specific listing code from the listing filter dropdown.

**Expected result:**
- All counters narrow to that listing only.
- Selecting *Todos* resets.

### TC-DASH-009: Real-time update — new lead arrives

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/dashboard` in tab A.
2. In tab B, simulate a new WhatsApp inbound lead (or write a Firestore doc directly with proper schema in a test-only flow).

**Expected result:**
- Tab A's *Total leads* counter increments within 2s without a manual refresh.
- Firestore listener fires; no full re-fetch (verify in Network tab).

### TC-DASH-010: Real-time update — conversation balance changes

**Priority:** P0
**Roles:** owner

**Steps:**
1. Trigger an initial outbound (which charges 1 credit).

**Expected result:**
- Balance tile decrements by 1 in real-time.

### TC-DASH-011: Agent scope on dashboard

**Priority:** P0
**Roles:** agent

**Steps:**
1. Sign in as agent owning 1 of 3 org listings.
2. Open `/dashboard`.

**Expected result:**
- Counters reflect ONLY data from the agent's listings.
- Other listings' leads/conversations are not counted.

### TC-DASH-012: Checkout intent banner

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/suscripcion`, start a Stripe checkout but abandon it (see TC-AUTH-032).
2. Return to `/dashboard`.

**Expected result:**
- Banner: *"Tienes una compra pendiente"* with **Reanudar** CTA.

### TC-DASH-013: Real-time listener cleanup

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/dashboard`.
2. Navigate to `/leads`.
3. In DevTools, check that no Firestore listeners from `/dashboard` remain (use `getAllSnapshotListeners`-style logging if available, or check that no further snapshots logged from the previous mount).

**Expected result:**
- All `onSnapshot` subscriptions established by `/dashboard` are unsubscribed.

### TC-DASH-014: Performance — first paint under 2s on broadband

**Priority:** P2
**Roles:** owner

**Steps:**
1. Open DevTools Performance.
2. Cold-load `/dashboard`.

**Expected result:**
- First contentful paint < 2s on Cable speed.
- Tile values populate within 3s.

---

## 5. Listings (`LIST`)

Covers `src/pages/Listings.tsx`, `src/services/listings.ts`, modal create/edit, address autocomplete, and the closure-reason flow.

### TC-LIST-001: Create Venta listing happy path

**Priority:** P0
**Roles:** owner / admin

**Steps:**
1. Open `/anuncios`.
2. Click **Crear anuncio**.
3. Select **Venta**.
4. Use the address search to pick `Calle de Alcalá, Madrid`.
5. Fill `listingCode`, price `350000`, m² `90`, rooms `3`.
6. Assign agent (self).
7. Submit.

**Expected result:**
- Listing doc created with `operationType: "Venta"`, `isActive: true`, `createdByUid: <self>`, geocoded address fields filled (street, city, province, postalCode, country, provinceNormalized).
- Toast: *"Anuncio creado"*.
- Listing appears at top of list with status badge *Activo*.

### TC-LIST-002: Create Alquiler — Larga temporada

**Priority:** P0
**Roles:** owner

**Steps:**
1. Repeat TC-LIST-001 with **Alquiler** + subtype **Larga temporada**, price `1200` (monthly).

**Expected result:**
- `operationType: "Alquiler"`, `rentalSubtype: "Larga temporada"` stored.

### TC-LIST-003: Create Alquiler — Vacacional

**Priority:** P1
**Roles:** owner

**Steps:**
1. Create rental with subtype **Vacacional**.

**Expected result:**
- `rentalSubtype: "Vacacional"` stored.
- AI listing resolution treats vacacional differently from larga temporada (covered in `AI` section).

### TC-LIST-004: Create Alquiler — Temporada

**Priority:** P1
**Roles:** owner

**Steps:**
1. Create rental with subtype **Temporada**.

**Expected result:**
- `rentalSubtype: "Temporada"` stored.

### TC-LIST-005: Create Alquiler — No aplica

**Priority:** P2
**Roles:** owner

**Steps:**
1. Create rental with subtype **No aplica**.

**Expected result:**
- `rentalSubtype: "No aplica"` stored.

### TC-LIST-006: Address autocomplete — Nominatim matches

**Priority:** P1
**Roles:** owner

**Steps:**
1. Type `Gran Vía 1 Madrid` into the address field.

**Expected result:**
- Dropdown shows ≥1 Nominatim suggestion within 1s.
- Selecting one fills street, city, province, postalCode, country, geo coords.

### TC-LIST-007: Address autocomplete — no matches

**Priority:** P2
**Roles:** owner

**Steps:**
1. Type `zzzqqqxxx`.

**Expected result:**
- *"Sin resultados"* state in dropdown.
- User can still submit if address is optional (or sees inline error if required).

### TC-LIST-008: Address autocomplete — network error

**Priority:** P2
**Roles:** owner

**Steps:**
1. Block requests to `nominatim.openstreetmap.org`.
2. Type a query.

**Expected result:**
- Graceful failure; field remains usable; no console exception bubbles to user.

### TC-LIST-009: Required field validation — listing code

**Priority:** P0
**Roles:** owner

**Steps:**
1. Leave `listingCode` blank; submit.

**Expected result:**
- Inline error.
- No Firestore write.

### TC-LIST-010: Duplicate listing code in same org

**Priority:** P0
**Roles:** owner

**Steps:**
1. Create a listing with `listingCode: "ABC-001"`.
2. Try to create another with the same code.

**Expected result:**
- Backend or UI rejects with Spanish message: *"Ya existe un anuncio con este código"*.

**Notes:** Confirm whether server enforces uniqueness or only the UI; if only UI, file an issue.

### TC-LIST-011: Agent assignment dropdown

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open the agent assignment dropdown in the create modal.

**Expected result:**
- Only members of the current org appear.
- Each entry shows display name + role.

### TC-LIST-012: Notification numbers multi-select — plan cap

**Priority:** P0
**Roles:** owner

**Steps:**
1. As a `free` plan user, attempt to select 2 notification numbers.

**Expected result:**
- Only 1 selectable (per `getMaxListingNotificationNumbers("free")`).
- Helper text mentions plan limit.
2. Repeat as `pro_plus`; confirm higher cap allowed.

### TC-LIST-013: Quick qualification toggle

**Priority:** P1
**Roles:** owner

**Steps:**
1. Enable **Cualificación rápida** in the create modal.
2. Save.
3. From a tester WhatsApp, send a message tied to that listing.

**Expected result:**
- `listing.quickQualificationEnabled: true`.
- Bot skips qualification questions; agent notification fires immediately.
- Lead doc shows `qualificationStatus: "qualified"` or equivalent.

### TC-LIST-014: Inline edit modal

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Editar** on a listing.
2. Change price.
3. Save.

**Expected result:**
- Listing updated.
- `updatedAt` Timestamp advances.
- Audit log entry written by `onListingWritten` trigger.

### TC-LIST-015: Agent can only edit own listings

**Priority:** P0
**Roles:** agent

**Steps:**
1. Sign in as agent.
2. Attempt to edit a listing whose `assignedAgentUid` is another user.

**Expected result:**
- Edit action absent or disabled.
- If attempted via DevTools, Firestore rules reject.

### TC-LIST-016: Deactivation requires closure reason

**Priority:** P0
**Roles:** owner

**Steps:**
1. Toggle a listing to inactive.

**Expected result:**
- Modal opens with required reason radio: `sold_to_qualified`, `rented_to_qualified`, `sold_to_other`, `rented_to_other`, `other`.
- Cannot save without selecting a reason.

### TC-LIST-017: Closure reason — sold_to_qualified

**Priority:** P0
**Roles:** owner

**Steps:**
1. Select **Vendido a un lead cualificado de Proplead**.
2. Pick the qualified lead from the dropdown.
3. Save.

**Expected result:**
- `closureInfo` saved with `reason: "sold_to_qualified"`, `qualifiedLeadId`, `qualifiedLeadName`, `closedAt`.
- Listing `isActive: false`.

### TC-LIST-018: Closure reason — rented_to_qualified

**Priority:** P0
**Roles:** owner

**Steps:**
1. Same as TC-LIST-017 with `rented_to_qualified` on an Alquiler listing.

**Expected result:**
- `closureInfo` includes correct reason.

### TC-LIST-019: Closure reason — sold_to_other / rented_to_other

**Priority:** P1
**Roles:** owner

**Steps:**
1. Deactivate with each external reason. No qualified lead picker is required.

**Expected result:**
- `closureInfo.reason` saved; `qualifiedLeadId` empty.

### TC-LIST-020: Closure reason — other (with notes)

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select **Otro**; enter free-text notes.
2. Save.

**Expected result:**
- `closureInfo.reason: "other"`, `notes: "<text>"`.

### TC-LIST-021: Re-activate closed listing

**Priority:** P1
**Roles:** owner

**Steps:**
1. Toggle an inactive listing back to active.

**Expected result:**
- `isActive: true`.
- `closureInfo` retained for audit (or cleared per design — record actual).

### TC-LIST-022: Bulk activate/deactivate

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select 3 listings via checkboxes.
2. Bulk-deactivate; choose `sold_to_other`.

**Expected result:**
- All 3 deactivated with same reason.
- Audit log entries written for each.

### TC-LIST-023: Sort by default

**Priority:** P2
**Roles:** owner

**Steps:**
1. Sort: **Predeterminado**.

**Expected result:**
- Order is creation order (or whatever the documented default is).

### TC-LIST-024: Sort by updated desc

**Priority:** P2
**Roles:** owner

**Steps:**
1. Edit a mid-list listing.
2. Sort by **Actualización descendente**.

**Expected result:**
- That listing jumps to top.

### TC-LIST-025: Sort by conversations / qualified leads / title

**Priority:** P2
**Roles:** owner

**Steps:**
1. Apply each sort.

**Expected result:**
- Order matches the respective field.

### TC-LIST-026: Listing badges reflect Firestore

**Priority:** P1
**Roles:** owner

**Steps:**
1. Check the conversation count badge on a listing.
2. Confirm matches `conversations` collection scoped by `listingCode`.

**Expected result:**
- Badges show real counts; updating a conversation propagates within a few seconds.

### TC-LIST-027: Mobile — action buttons no horizontal overflow

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/anuncios` at 375×667.

**Expected result (when bug fixed):**
- No 119px horizontal overflow; action buttons remain on-screen or collapse into menu.

**Notes:** Known P0 in mobile audit.

### TC-LIST-028: Read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. While impersonating, attempt to create/edit/deactivate a listing.

**Expected result:**
- All write actions disabled.

### TC-LIST-029: Reconcile agent scope after assignment change

**Priority:** P0
**Roles:** owner

**Steps:**
1. Change `assignedAgentUid` on a listing.

**Expected result:**
- `onListingWritten` trigger fires.
- All leads with that `listingCode` have `assignedAgentUid` updated (via `syncAssignedAgentUidForListingCode`).
- Old agent loses visibility to the lead in `/leads`; new agent gains it.

---

## 6. Leads (`LEAD`)

Covers `src/pages/Leads.tsx`, `LeadDetails.tsx`, `LeadEditModal.tsx`. Complex page with tabs, filters, bulk operations, and CSV export. Known to render 700+ rows without virtualization (mobile P0 perf issue).

### TC-LEAD-001: List view loads with default filter

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/leads`.

**Expected result:**
- Tab **Todos** active.
- Leads ordered by created date desc.
- Pagination / infinite-scroll loads in chunks (or all at once — record actual).

### TC-LEAD-002: State tab — No cualificados

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **No cualificados**.

**Expected result:**
- Only leads with `qualificationStatus = "not_qualified"` visible.
- Count badge matches list size.

### TC-LEAD-003: State tab — Sin respuesta

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Sin respuesta**.

**Expected result:**
- Only leads with `qualificationStatus = "no_response"` visible.

### TC-LEAD-004: State tab — Cualificados

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Cualificados**.

**Expected result:**
- Only `qualificationStatus = "qualified"` visible.

### TC-LEAD-005: State tab — Rechazados

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Rechazados**.

**Expected result:**
- Only `qualificationStatus = "rejected"` visible.

### TC-LEAD-006: Search debounce 300ms

**Priority:** P1
**Roles:** owner

**Steps:**
1. Type a phone fragment quickly.
2. Watch Network tab.

**Expected result:**
- Only one filtered query fires 300ms after typing stops.

### TC-LEAD-007: Search by name

**Priority:** P1
**Roles:** owner

**Steps:**
1. Type *"María"*.

**Expected result:**
- Only leads whose `name` matches appear.

### TC-LEAD-008: Search by phone

**Priority:** P1
**Roles:** owner

**Steps:**
1. Type a partial E.164 phone fragment.

**Expected result:**
- Leads with matching `phone` appear.

### TC-LEAD-009: Filter — listing type Venta

**Priority:** P1
**Roles:** owner

**Steps:**
1. Apply *Venta* filter.

**Expected result:**
- Only leads where their listing is `operationType: "Venta"` appear.

### TC-LEAD-010: Filter — listing type Alquiler

**Priority:** P1
**Roles:** owner

**Steps:**
1. Apply *Alquiler* filter.

**Expected result:**
- Only leads tied to rental listings.

### TC-LEAD-011: Filter — listing code search

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter by an exact listing code.

**Expected result:**
- Only that listing's leads.

### TC-LEAD-012: Filter — pets true

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter pets = *Sí*.

**Expected result:**
- Only leads with `pets: true`.

### TC-LEAD-013: Filter — pets false

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter pets = *No*.

**Expected result:**
- Only `pets: false`.

### TC-LEAD-014: Filter — pets unset

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter pets = *Sin definir*.

**Expected result:**
- Only leads where `pets` is `null`/undefined.

### TC-LEAD-015: Filter — payment method Contado

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter `paymentMethod = "Contado"`.

**Expected result:**
- Only cash-buyers.

### TC-LEAD-016: Filter — payment method Hipoteca

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter `paymentMethod = "Hipoteca"`.

**Expected result:**
- Only mortgage buyers.

### TC-LEAD-017: Filter — income range

**Priority:** P1
**Roles:** owner

**Steps:**
1. Set income min/max.

**Expected result:**
- Only leads with `income` in range.
- Empty income leads excluded.

### TC-LEAD-018: Filter — tags multi-select

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select two tags.

**Expected result:**
- Leads with ANY (or ALL — record actual) of the tags appear.

### TC-LEAD-019: Filter — listing active/inactive

**Priority:** P1
**Roles:** owner

**Steps:**
1. Toggle inactive listings off.

**Expected result:**
- Leads whose listing is `isActive: false` hidden.

### TC-LEAD-020: Combined filters

**Priority:** P1
**Roles:** owner

**Steps:**
1. Combine status + listing code + tags + income range.

**Expected result:**
- Only leads matching ALL filters.

### TC-LEAD-021: Column visibility toggle

**Priority:** P2
**Roles:** owner

**Steps:**
1. Open the column picker.
2. Toggle visible columns from 12 → 18.
3. Reload the page.

**Expected result:**
- Column visibility persists via `localStorage` key (e.g. `leads-columns`).

### TC-LEAD-022: Multi-select with header checkbox

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click header checkbox.

**Expected result:**
- All visible leads selected.
- Selection count displayed.

### TC-LEAD-023: Selection persists across tab switches

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select 3 leads in **Todos**.
2. Switch to **Cualificados** and back.

**Expected result:**
- The 3 selections still highlighted.

### TC-LEAD-024: Bulk status change

**Priority:** P0
**Roles:** owner

**Steps:**
1. Select 2 leads.
2. Apply bulk **Marcar como cualificados**.

**Expected result:**
- Both leads' `qualificationStatus = "qualified"`.
- Audit log entries written.

### TC-LEAD-025: Bulk add tag

**Priority:** P1
**Roles:** owner

**Steps:**
1. Bulk-add tag *"hot-lead"*.

**Expected result:**
- All selected leads gain the tag (deduped).

### TC-LEAD-026: Bulk remove tag

**Priority:** P1
**Roles:** owner

**Steps:**
1. Bulk-remove a tag they share.

**Expected result:**
- Tag removed from all.

### TC-LEAD-027: Bulk delete with confirmation

**Priority:** P0
**Roles:** owner

**Steps:**
1. Bulk-delete 2 leads.
2. Confirm in dialog.

**Expected result:**
- Leads removed from Firestore (or marked deleted per data model).
- Associated conversations remain (chat is not org-owned per [[feedback_chatid_not_org_owned]]).

### TC-LEAD-028: Inline edit modal — all fields

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click a lead.
2. Edit name, notes, tags, qualificationStatus, pets, income, paymentMethod.
3. Save.

**Expected result:**
- Lead doc updated.
- If the conversation has the same name/notes/tags surfaces, they mirror.

### TC-LEAD-029: Tag autocomplete

**Priority:** P2
**Roles:** owner

**Steps:**
1. In the tag input, type the first chars of an existing tag.

**Expected result:**
- Dropdown shows matching existing tags.
- *"Crear etiqueta '<text>'"* option appears for new tags.

### TC-LEAD-030: Tag creation

**Priority:** P2
**Roles:** owner

**Steps:**
1. Create a brand-new tag.

**Expected result:**
- Tag added to lead and to the org's tag pool.

### TC-LEAD-031: CSV export of visible leads

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Exportar CSV**.

**Expected result:**
- CSV download contains visible columns and currently-filtered leads.
- Phone numbers formatted as E.164 strings (so spreadsheets don't strip the `+`).

### TC-LEAD-032: Agent scope on leads

**Priority:** P0
**Roles:** agent

**Steps:**
1. Sign in as agent.
2. Open `/leads`.

**Expected result:**
- Only leads from listings the agent owns are visible.
- Other listings' leads are not visible even via direct Firestore query (rules verified in `SEC`).

### TC-LEAD-033: Read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. Try to edit a lead while impersonating.

**Expected result:**
- All edit/bulk/delete buttons disabled.

### TC-LEAD-034: Performance with 700+ leads

**Priority:** P0
**Roles:** owner
**Preconditions:** Seed org has ≥700 leads.

**Steps:**
1. Open `/leads`.
2. Scroll to the bottom.
3. Type in the search field.

**Expected result (when virtualization implemented):**
- Page interactive within 3s.
- Search remains responsive (no jank > 100ms).

**Notes:** No virtualization today; record current behavior as a known issue and file a follow-up.

### TC-LEAD-035: Legacy redirect `/cualificados?ad=X`

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/cualificados?ad=ABC-001`.

**Expected result:**
- Redirects to `/leads?status=qualified&ad=ABC-001`.
- Listing filter is pre-applied.

### TC-LEAD-036: Mobile — state tabs forced scroll

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/leads` at 375×667.

**Expected result (when bug fixed):**
- All 5 state tabs visible without horizontal scroll, or collapsed into a dropdown.

**Notes:** Known P0 in mobile audit.

### TC-LEAD-037: Cross-tenant lead scoping

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Sign in to Org A.
2. Note a lead's phone (e.g. `+34612345678`).
3. Switch to Org B (where same phone is also a lead).
4. Confirm Org B shows its own conversation/notes, not Org A's.

**Expected result:**
- Same `chatId` exists under both orgs but data is fully scoped ([[feedback_chatid_not_org_owned]]).

---

## 7. Conversations (`CONV`)

Covers `src/pages/Conversations.tsx`, `src/components/ui/InboxShell.tsx`, lead details sidebar, message thread, manual send, bot toggle, opt-out handling.

### TC-CONV-001: Leads tab loads identified conversations

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/conversaciones`.

**Expected result:**
- Tab **Leads** active.
- List shows conversations linked to a Lead doc (via `chatId`).

### TC-CONV-002: No identificados tab

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **No identificados**.

**Expected result:**
- Conversations without a matching Lead doc visible.
- Each item shows phone and last message.

### TC-CONV-003: Filter — active vs finished

**Priority:** P1
**Roles:** owner

**Steps:**
1. Toggle filter between **Activas** and **Finalizadas**.

**Expected result:**
- `isFinished` boolean drives the filter.

### TC-CONV-004: Filter — listing operation type

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter by *Venta* and *Alquiler*.

**Expected result:**
- Only conversations whose listing matches.

### TC-CONV-005: Filter — qualification status

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter conversations by lead qualification status.

**Expected result:**
- Conversations match the lead's status.

### TC-CONV-006: Filter — assistant enabled/disabled

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter by bot enabled vs disabled (`botDisabled` flag).

**Expected result:**
- Only matching conversations.

### TC-CONV-007: Filter — date range

**Priority:** P1
**Roles:** owner

**Steps:**
1. Apply a date range on `lastMessage`.

**Expected result:**
- Only conversations active in that window.

### TC-CONV-008: Filter — opt-out

**Priority:** P1
**Roles:** owner

**Steps:**
1. Toggle filter to show opted-out only.

**Expected result:**
- Only `optedOut: true` conversations.

### TC-CONV-009: Real-time message thread

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open a conversation in tab A.
2. From the tester WhatsApp, send a new inbound message.

**Expected result:**
- Tab A's thread shows the new message within 2s (Firestore listener).
- No manual refresh needed.

### TC-CONV-010: New-message pulse indicator (unidentified)

**Priority:** P2
**Roles:** owner

**Steps:**
1. Open `/conversaciones` **No identificados** tab.
2. Note the "last viewed" timestamp stored in localStorage.
3. Receive a new inbound (test).

**Expected result:**
- A pulse / dot appears on the tab or the conversation row.
- Clicking the conversation clears the indicator and updates localStorage.

### TC-CONV-011: Manual message send via Twilio

**Priority:** P0
**Roles:** owner
**Preconditions:** Org uses Twilio provider; conversation has an open 24h window.

**Steps:**
1. Open a conversation.
2. Type a message; click **Enviar**.

**Expected result:**
- `sendMessage` cloud function called.
- `messagingProvider.sendTextMessage` routes to Twilio.
- WhatsApp delivers the message to the tester device.
- Message appears in thread with `role: "assistant"`.
- 1 credit deducted if this is the initial outbound (`deductOrgConversationForInitialOutboundOnce`).

### TC-CONV-012: Manual message send via Cloud API

**Priority:** P0
**Roles:** super_admin
**Preconditions:** Org overridden to Cloud API.

**Steps:**
1. Same as TC-CONV-011 but on Cloud API org.

**Expected result:**
- `cloudApiClient.sendText` invoked.
- Message arrives.

### TC-CONV-013: Outside 24h window forces template fallback

**Priority:** P0
**Roles:** owner
**Preconditions:** Conversation has had no inbound in >24h.

**Steps:**
1. Try to send a plain free-form message.

**Expected result:**
- Twilio error detected by `isTwilioOutside24hWindowError`.
- Fallback: `sendTextWithTemplateFallback` sends an approved template (`returningLeadEs`/`returningLeadEn`).
- Thread shows the template body.

### TC-CONV-014: Trigger assistant response on demand

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open a conversation with a recent lead question.
2. Click **Pedir respuesta al asistente**.

**Expected result:**
- `triggerBot` cloud function called.
- AI generates and sends a response.
- Message appears with `role: "assistant"`.

### TC-CONV-015: Bot disable toggle

**Priority:** P0
**Roles:** owner

**Steps:**
1. In a conversation, toggle **Asistente** off.

**Expected result:**
- `botDisabled: true` in conversation doc.
- Subsequent inbound messages do NOT trigger an auto-response.
- Audit log entry written (`bot_toggle`).

### TC-CONV-016: Bot enable toggle

**Priority:** P0
**Roles:** owner

**Steps:**
1. Re-enable bot.

**Expected result:**
- `botDisabled: false`.
- Next inbound triggers AI auto-response.

### TC-CONV-017: Lead details sidebar — notes mirror

**Priority:** P1
**Roles:** owner

**Steps:**
1. In the sidebar, edit notes.

**Expected result:**
- Notes written to both `conversation.notes` and `lead.notes` (if a lead is linked).
- Same edit visible from `/leads`.

### TC-CONV-018: Lead details sidebar — tags

**Priority:** P1
**Roles:** owner

**Steps:**
1. Add/remove tags.

**Expected result:**
- Tags mirror to lead.

### TC-CONV-019: Sidebar — load lead by chatId

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open an identified conversation whose lead was created separately (different ID but same chatId).

**Expected result:**
- Sidebar fetches the lead by `chatId` and shows its data.

### TC-CONV-020: Convert unidentified to lead

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open an unidentified conversation.
2. Click **Asignar a anuncio**.
3. Select a listing code.

**Expected result:**
- Lead doc created with `phone`, `chatId`, `listingCode`, `operationType` from listing.
- Conversation now appears in **Leads** tab.

### TC-CONV-021: Message download/export

**Priority:** P2
**Roles:** owner

**Steps:**
1. From a conversation, click **Descargar historial**.

**Expected result:**
- File downloaded (text/CSV/JSON — record format).
- Contains all messages with timestamps and roles.

### TC-CONV-022: Opt-out keyword inbound

**Priority:** P0
**Roles:** lead phone (external)

**Steps:**
1. From tester device, send `STOP` (or `NO`, `UNSUBSCRIBE`) to the bot.

**Expected result:**
- `isOptOutMessage` detects opt-out.
- `applyOptOut` marks `optedOut: true` and adds chat to ignore list.
- Bot does NOT respond.
- Audit log entry written (`opt_out_captured`).

### TC-CONV-023: Opt-out filtered from active list

**Priority:** P0
**Roles:** owner

**Steps:**
1. After TC-CONV-022, view `/conversaciones`.

**Expected result:**
- That conversation no longer in the default active list.
- Visible under opt-out filter (TC-CONV-008).

### TC-CONV-024: Cross-tenant chat isolation

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Same `chatId` exists under Org A and Org B (after a cross-org handoff).
2. Open Org A's conversation for that chatId.

**Expected result:**
- Only Org A's history visible.
- Org B's messages not leaked.

### TC-CONV-025: Read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. Try to send a message, toggle bot, edit notes.

**Expected result:**
- All write actions disabled.

### TC-CONV-026: Mobile — message bubble text overflow

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open a conversation at 375×667 with a long URL or word.

**Expected result (when bug fixed):**
- Message bubble wraps; no horizontal overflow.

**Notes:** Known P0 in mobile audit.

### TC-CONV-027: Conversation listener cleanup

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open conversation A; navigate to conversation B.
2. Inspect Firestore listeners.

**Expected result:**
- A's listener unsubscribed on unmount; only B's active.

### TC-CONV-028: Long thread performance

**Priority:** P1
**Roles:** owner
**Preconditions:** Conversation has 500+ messages.

**Steps:**
1. Open the conversation.
2. Scroll to the top.

**Expected result:**
- Renders without jank.
- Scroll-to-bottom on new message works.

---

## 8. Organization & Team (`ORG`)

Covers `src/pages/Organizacion.tsx` (renamed from `TeamManagement.tsx`), `src/services/organization.ts`, invitation cloud functions (`sendInvitation`, `acceptInvitation`, `getInvitationPreview`), `updateTeamMember`, and `listOrganizationsForSuperAdmin`.

### TC-ORG-001: Team list shows members

**Priority:** P0
**Roles:** owner / admin

**Steps:**
1. Open `/organizacion`.

**Expected result:**
- All members displayed with display name, email, role, last access timestamp.
- Pending invitations listed separately.

### TC-ORG-002: Send invitation — email + role

**Priority:** P0
**Roles:** owner / admin

**Steps:**
1. Click **Invitar miembro**.
2. Enter `inviteme+staging@proplead.io` and choose role *agent*.
3. Submit.

**Expected result:**
- `sendInvitation` cloud function called.
- Invitation doc created at `organizations/{orgId}/invitations/{inviteId}` with `expiresAt` (e.g. +7 days), role, recipient email.
- Invitation email arrives.
- The invitee can complete TC-AUTH-014.

### TC-ORG-003: Send invitation — duplicate active invite

**Priority:** P2
**Roles:** owner

**Steps:**
1. Invite the same email twice within the expiry window.

**Expected result:**
- UI surfaces a Spanish warning: *"Ya hay una invitación activa para este correo"*.
- Existing invitation reused or replaced; no duplicate doc proliferation.

### TC-ORG-004: Resend invitation

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Reenviar** on a pending invitation.

**Expected result:**
- Email resent.
- `expiresAt` may be refreshed (record actual behavior).

### TC-ORG-005: Revoke invitation

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Revocar** on a pending invitation.

**Expected result:**
- Doc deleted (or marked revoked).
- Subsequent attempt to use the link returns expired/invalid (TC-AUTH-017 path).

### TC-ORG-006: Change role — member → admin

**Priority:** P0
**Roles:** owner

**Steps:**
1. From the team list, change a member's role to *admin*.

**Expected result:**
- `updateTeamMember` updates the user's role in the membership doc.
- The user's next refresh picks up the new role (their AuthContext refreshes).
- Audit log written.

### TC-ORG-007: Change role — admin → owner

**Priority:** P0
**Roles:** owner

**Steps:**
1. Promote an admin to owner.

**Expected result:**
- Org now has 2 owners.
- The promoted user gains billing access.

### TC-ORG-008: Cannot edit super_admin role from UI

**Priority:** P0
**Roles:** owner

**Steps:**
1. Try to change role on a super_admin user.

**Expected result:**
- Dropdown disabled or role field read-only.

### TC-ORG-009: Cannot remove self if last owner

**Priority:** P0
**Roles:** owner (sole owner)

**Steps:**
1. Try to remove yourself from the team.

**Expected result:**
- Action blocked.
- Spanish error: *"No puedes eliminar al último propietario"*.

### TC-ORG-010: Remove other team member

**Priority:** P0
**Roles:** owner

**Steps:**
1. Remove another member.

**Expected result:**
- Membership doc removed.
- The removed user loses access to the org (AuthContext drops it from `availableOrganizations`).
- Listings/leads they owned remain; agent scope reconciled (`reconcileAgentScopeForOrganization`).

### TC-ORG-011: Impersonate from team list (super_admin)

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Click **Impersonar** on a target member.

**Expected result:**
- Routes to `/dashboard` impersonating the target (TC-AUTH-028).

### TC-ORG-012: Organization details form persistence

**Priority:** P1
**Roles:** owner / admin

**Steps:**
1. Edit `agencyName`, `legalName`, `taxId`, `address`, `employeesCount`, `contactPhone`, `website`.
2. Save.

**Expected result:**
- Values persisted to `organizationSettings`.
- Reload page; values still present.

### TC-ORG-013: Tax ID validation

**Priority:** P2
**Roles:** owner

**Steps:**
1. Enter an invalid `taxId` (random letters).

**Expected result:**
- If validation exists: inline error (record actual).
- If not: documented as a follow-up.

### TC-ORG-014: Notification numbers panel — legacy view

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open the notification numbers panel.

**Expected result:**
- Legacy notification numbers (`BotConfig.notificationNumbers` comma-separated string) shown.
- v2 numbers shown alongside, with verified badge if applicable.

### TC-ORG-015: Notification numbers — verification entry point

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Añadir número**.

**Expected result:**
- Modal opens; flow continues into TC-NOTIF-001.

### TC-ORG-016: Legacy redirect `/equipo` → `/organizacion`

**Priority:** P1
**Roles:** owner

**Steps:**
1. Navigate to `/equipo`.

**Expected result:**
- Redirects to `/organizacion` preserving any query params.

### TC-ORG-017: Cross-tenant — Org A admin cannot list Org B members

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Sign in to Org A.
2. Attempt direct Firestore query against `organizations/{otherOrgId}/members`.

**Expected result:**
- Firestore rules deny.
- UI cannot navigate there.

### TC-ORG-018: super_admin can list all orgs

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Call `listOrganizationsForSuperAdmin` (from `/admin/tools` or backend).

**Expected result:**
- Returns full list with org IDs, names, owners.
- Sensitive secrets not exposed in response.

### TC-ORG-019: Read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. Try to send/revoke invitations, edit org details.

**Expected result:**
- All write actions disabled.

---

## 9. Configuration (`CFG`)

Covers `src/pages/Configuracion.tsx`, plus `exportMyData` and `deleteMyOrganization` cloud functions.

### TC-CFG-001: Bot style preview

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/configuracion`.
2. Click each available bot style; observe the preview.

**Expected result:**
- Each style renders sample messages in its tone.
- Active style highlighted.

### TC-CFG-002: Activate bot style

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select a non-default style and save.

**Expected result:**
- `botConfig.activeStyleId` updated.
- `getActiveStyle` returns the new style.
- Next AI response uses the new tone (verify via `/botTest`).

### TC-CFG-003: Data export

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Exportar mis datos**.
2. Confirm.

**Expected result:**
- `exportMyData` cloud function called.
- Within a few minutes, an email arrives with a download link to the export JSON/ZIP.
- File contains all conversations, leads, listings, members, settings — but no secrets.
- Audit log entry written.

### TC-CFG-004: Organization deletion — confirmation flow

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Eliminar organización**.
2. Read the warning and 30-day grace explanation.
3. Type the agency name to confirm.
4. Submit.

**Expected result:**
- `deleteMyOrganization` cloud function called.
- Org marked `deletedAt` (soft delete).
- Meta Data Deletion Request initiated; `dataDeletionRequests/{code}` doc created.
- All members lose access on next session.
- Email confirmation sent.

### TC-CFG-005: Organization deletion — 30-day purge

**Priority:** P0
**Roles:** scheduled job

**Steps:**
1. After TC-CFG-004, advance 30+ days (or manually adjust `deletedAt` via admin tool).
2. Trigger `purgeDeletedOrganizations`.

**Expected result:**
- All org data hard-deleted from Firestore and Storage.
- `dataDeletionRequests/{code}` status → `deleted`.
- DeletionStatus page (TC-LAND-015) reflects this.

### TC-CFG-006: Organization deletion — cancel within grace

**Priority:** P1
**Roles:** owner
**Preconditions:** Org soft-deleted (TC-CFG-004) but not yet purged.

**Steps:**
1. (If feature exists) Click **Restaurar organización**.

**Expected result (if implemented):**
- `deletedAt` cleared; org reactivated.
- All data intact.

**Notes:** Confirm whether restore exists in this build; if not, document as feature gap.

### TC-CFG-007: Read-only during impersonation

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. Try to delete org or export data while impersonating.

**Expected result:**
- Buttons disabled or actions blocked server-side.

### TC-CFG-008: Non-owner cannot delete org

**Priority:** P0
**Roles:** admin / member / agent

**Steps:**
1. Open `/configuracion` as non-owner.

**Expected result:**
- Delete-org section hidden or disabled.
- Direct call to `deleteMyOrganization` rejected.

---

## 10. Subscription & Billing (`SUB`)

Covers `src/pages/Subscription.tsx`, `functions/src/services/subscriptionService.ts`, `functions/src/services/billingService.ts`, `functions/src/services/stripeService.ts`, plus the Stripe webhook handler.

### TC-SUB-001: Plan tiers render

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/suscripcion`.

**Expected result:**
- 6 tiers visible: free, plus, pro, pro_plus, enterprise, custom.
- Each tier shows monthly price, conversation allowance, bonus conversations.
- *Popular* badge on the recommended tier.

### TC-SUB-002: Monthly / annual toggle

**Priority:** P1
**Roles:** owner

**Steps:**
1. Toggle between **Mensual** and **Anual**.

**Expected result:**
- Prices update with annual discount.
- Total displayed for annual (12× discounted monthly).

### TC-SUB-003: Comprar pack — Stripe checkout success

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Comprar pack** (40 conversations for €10 equivalent).
2. Complete checkout with test card `4242 4242 4242 4242`.

**Expected result:**
- Stripe checkout session created (`createStripeCheckout`).
- `stripeWebhook` receives `checkout.session.completed`.
- `addOrgConversationsForPaymentIntentOnce` adds 40 to balance (idempotent).
- Balance tile on `/dashboard` and `/suscripcion` increments by 40.
- Receipt email sent by Stripe.

### TC-SUB-004: Comprar pack — payment fails

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Comprar pack**.
2. Use test card `4000 0000 0000 0341` (declined).

**Expected result:**
- Stripe shows failure.
- No conversations added.
- No double-deduct (balance unchanged).

### TC-SUB-005: Comprar pack — SCA challenge

**Priority:** P1
**Roles:** owner

**Steps:**
1. Use test card `4000 0025 0000 3155` (requires authentication).

**Expected result:**
- 3DS challenge presented in checkout.
- On confirm, payment succeeds and balance increments.

### TC-SUB-006: Comprar pack — idempotency

**Priority:** P0
**Roles:** Stripe

**Steps:**
1. Replay the `checkout.session.completed` webhook with the same `event.id`.

**Expected result:**
- `markInvoiceProcessed` flags duplicate; balance does NOT double-credit.

### TC-SUB-007: Plan upgrade — free → plus

**Priority:** P0
**Roles:** owner (currently free)

**Steps:**
1. Click **Mejorar a Plus**.
2. Complete Stripe checkout (subscription).

**Expected result:**
- Subscription created on Stripe.
- `customer.subscription.created` and `invoice.payment_succeeded` webhooks fire.
- `grantSubscriptionConversations("plus", orgId)` adds the plan's base allowance.
- Subscription doc at `organizations/{orgId}/subscription` reflects new plan + status `active`.

### TC-SUB-008: Plan downgrade with proration

**Priority:** P0
**Roles:** owner

**Steps:**
1. From pro → plus, click the downgrade CTA.
2. Inspect the proration preview (`previewSubscriptionChange`).
3. Confirm.

**Expected result:**
- `updateSubscriptionPlan` updates Stripe with proration_behavior matching design (e.g. `create_prorations`).
- Credit appears on next invoice.

### TC-SUB-009: Plan change — same tier monthly to annual

**Priority:** P1
**Roles:** owner

**Steps:**
1. Switch billing period without changing tier.

**Expected result:**
- Stripe subscription updated to annual price ID.
- Prorated charge displayed.

### TC-SUB-010: Cancel via billing portal

**Priority:** P0
**Roles:** owner

**Steps:**
1. Click **Gestionar facturación** → opens Stripe portal.
2. Cancel subscription at period end.

**Expected result:**
- Stripe marks `cancel_at_period_end: true`.
- Webhook `customer.subscription.updated` fires.
- Internal subscription doc reflects cancellation date.
- At period end, `customer.subscription.deleted` fires; conversations no longer granted.

### TC-SUB-011: Auto-recharge — enable

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open auto-recharge settings.
2. Enable; threshold = 5 conversations; amount = 40 conversations.
3. Save.

**Expected result:**
- `saveAutoRechargeSettings` persists `enabled: true`, threshold, amount.
- `getAutoRechargeSettings` returns same values on reload.

### TC-SUB-012: Auto-recharge — fires below threshold

**Priority:** P0
**Roles:** automated

**Steps:**
1. With auto-recharge enabled, deplete the balance to 4 (below 5 threshold).
2. Trigger any function that calls `runOrgAutoRechargeIfNeeded`.

**Expected result:**
- `createConfirmedOffSessionTopUp` charges the saved payment method.
- 40 conversations added.
- Audit / usage log shows event type `auto_recharge`.

### TC-SUB-013: Auto-recharge — no double fire

**Priority:** P0
**Roles:** automated

**Steps:**
1. Concurrently trigger two `runOrgAutoRechargeIfNeeded` calls.

**Expected result:**
- Only one charge succeeds (idempotency / locking).
- Balance reflects only one increment.

### TC-SUB-014: Conversation balance — initial outbound charges 1 credit

**Priority:** P0
**Roles:** owner

**Steps:**
1. Note current balance.
2. Send the first agent message to a new conversation.

**Expected result:**
- `deductOrgConversationForInitialOutboundOnce` deducts 1 credit.
- Balance decremented by exactly 1.

### TC-SUB-015: Conversation balance — inbound free

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Note current balance.
2. Tester sends an inbound WhatsApp message.

**Expected result:**
- Balance unchanged.

### TC-SUB-016: Conversation balance — subsequent outbound within session

**Priority:** P0
**Roles:** owner

**Steps:**
1. After initial outbound, send several more agent messages in the same conversation.

**Expected result:**
- No additional credit deducted (only initial outbound costs).
- Confirm via `deductOrgConversationOnce` is not re-invoked for the same conversation key.

### TC-SUB-017: Conversation balance — idempotency under retry

**Priority:** P0
**Roles:** automated

**Steps:**
1. Replay the same initial-outbound event (same idempotency key).

**Expected result:**
- `deductOrgConversationOnce` no-ops on the second call.

### TC-SUB-018: Failed payment email

**Priority:** P0
**Roles:** Stripe

**Steps:**
1. Trigger `invoice.payment_failed` webhook (with retry card).

**Expected result:**
- `sendPaymentFailedNotification` emails the owner.
- Subscription doc set to `past_due`.
- Owner sees a banner on `/suscripcion` or `/dashboard` prompting payment update.

### TC-SUB-019: Low balance notification

**Priority:** P0
**Roles:** automated

**Steps:**
1. Drop balance below the low-balance threshold (per `subscriptionService` logic).

**Expected result:**
- `sendLowBalanceNotification` emails the owner.
- Email arrives once per threshold crossing (no spam).

### TC-SUB-020: Billing portal link

**Priority:** P1
**Roles:** owner

**Steps:**
1. Click **Gestionar facturación**.

**Expected result:**
- `createBillingPortalSession` returns a Stripe-hosted URL.
- New tab opens to the portal.
- User can update card, view invoices.

### TC-SUB-021: Breakdown modal

**Priority:** P2
**Roles:** owner

**Steps:**
1. Click the cost breakdown info icon.

**Expected result:**
- Modal explains pricing (per-plan allowance, top-up cost, taxes if applicable).

### TC-SUB-022: Mobile — balance card 133px overflow

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/suscripcion` at 375×667.

**Expected result (when bug fixed):**
- No 133px horizontal overflow on the balance card.

**Notes:** Known P0 in mobile audit.

### TC-SUB-023: Webhook signature validation

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to `stripeWebhook` with a payload but invalid signature.

**Expected result:**
- 400 response; no event processed.
- `constructWebhookEvent` raises and is caught.

### TC-SUB-024: Stripe customer + subscription IDs merged on org

**Priority:** P1
**Roles:** automated

**Steps:**
1. After first successful checkout, inspect org doc.

**Expected result:**
- `stripeCustomerId` and `stripeSubscriptionId` merged via `mergeOrgStripeBillingFields`.
- Future portal sessions reuse the same customer.

### TC-SUB-025: Activate free plan

**Priority:** P1
**Roles:** owner (post-trial)

**Steps:**
1. From a trial ending state, click **Activar plan gratis**.

**Expected result:**
- `activateFreePlan` cloud function called.
- Org plan set to `free`; allowance applied.
- Usage log records `free_plan_activation`.

### TC-SUB-026: Non-owner cannot start checkout

**Priority:** P0
**Roles:** member / agent

**Steps:**
1. Open `/suscripcion`.
2. Attempt to click upgrade.

**Expected result:**
- Buttons hidden or disabled.
- Direct call to `createSubscriptionCheckout` rejected with auth error.

---

## 11. Usage Analytics (`USE`)

Covers `/uso` page and `billingService` event-log queries. Restricted to owner / admin / super_admin.

### TC-USE-001: Page gated to right roles

**Priority:** P0
**Roles:** member / agent

**Steps:**
1. Sign in as member or agent.
2. Try to navigate to `/uso`.

**Expected result:**
- Redirect or 403 view.

### TC-USE-002: Credit balance display

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/uso`.

**Expected result:**
- Current balance displayed prominently.
- Matches `getOrgConversationBalance(orgId)`.

### TC-USE-003: Range selector — thisMonth

**Priority:** P1
**Roles:** owner

**Steps:**
1. Select *Este mes*.

**Expected result:**
- Transaction list narrows to current calendar month.

### TC-USE-004: Range selector — last30 / last90 / all

**Priority:** P1
**Roles:** owner

**Steps:**
1. Test each range.

**Expected result:**
- List adjusts accordingly.

### TC-USE-005: Event type segmentation

**Priority:** P1
**Roles:** owner

**Steps:**
1. Inspect at least one example of each event type:
   - `initial_outbound`
   - `intake_outbound`
   - `manual_purchase`
   - `auto_recharge`
   - `subscription_grant`
   - `free_plan_activation`

**Expected result:**
- Each event has a distinct badge color/tone.
- Amount, timestamp, and contextual metadata correct.

### TC-USE-006: Empty state for new org

**Priority:** P2
**Roles:** owner (fresh org)

**Steps:**
1. Open `/uso`.

**Expected result:**
- Empty state with helper copy: *"Aún no hay actividad"*.

### TC-USE-007: Pagination / virtualization

**Priority:** P2
**Roles:** owner
**Preconditions:** Org has hundreds of events.

**Steps:**
1. Scroll the transaction list.

**Expected result:**
- Lazy loading or pagination keeps the page responsive.

---

## 12. Alerts & Monitoring (`ALRT`)

Covers `src/pages/Alerts.tsx`, `functions/src/services/alertCatalog.ts`, the scheduled status report, and on-demand alert checks.

### TC-ALRT-001: Alert catalog renders

**Priority:** P1
**Roles:** super_admin / admin

**Steps:**
1. Open `/alertas`.

**Expected result:**
- All catalog alerts visible with: type, current severity, last triggered timestamp, 24h count.

### TC-ALRT-002: Toggle alert enable/disable

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Toggle an alert off.
2. Confirm Firestore `alertCatalog/{alertId}.enabled: false`.
3. Toggle back on.

**Expected result:**
- Disabled alerts do not fire `sendAlert`.

### TC-ALRT-003: Run check manually

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Click **Ejecutar comprobación** on a specific alert.
2. Watch the log panel.

**Expected result:**
- `runAlertCheck` invoked; result streams to the log panel (info or error lines with timestamps).

### TC-ALRT-004: Real-time log streaming

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Trigger several events in quick succession.

**Expected result:**
- Log panel updates in near real-time (≤2s).
- Older entries scroll up.

### TC-ALRT-005: testAlert end-to-end

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Click **Probar alerta**.

**Expected result:**
- `testAlert` cloud function sends a WhatsApp message via the org's notification numbers.
- Message body matches the canned test text.

### TC-ALRT-006: Twice-daily status report

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Manually invoke `twiceDailyStatusReportTask` for an org.

**Expected result:**
- Report message sent to org's notification numbers.
- Contains conversation balance, failed messages count, recent sync results.

### TC-ALRT-007: Alert delivery via WhatsApp

**Priority:** P0
**Roles:** automated

**Steps:**
1. Cause a real alert (e.g. drain balance below threshold).

**Expected result:**
- `sendAlert` delivers the alert through `messagingProvider`.
- Outside the 24h window, falls back to approved template (per [[project_whatsapp_template_category]] MARKETING category).

### TC-ALRT-008: Org members can read only own-org alerts

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Try to fetch `alerts/{otherOrgId}/...` via DevTools.

**Expected result:**
- Firestore rules deny.

---

## 13. Audit Log (`AUD`)

Covers `src/pages/AuditLog.tsx`, `functions/src/services/auditService.ts`, and the four Firestore triggers `onLeadWritten`, `onConversationWritten`, `onListingWritten`, `onConfigWritten`.

### TC-AUD-001: Page loads recent entries

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/historial`.

**Expected result:**
- Recent audit entries shown with: timestamp, entity type, action, user, change details.

### TC-AUD-002: Filter by entity type

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter entity type = *lead*.

**Expected result:**
- Only lead entries.
- Repeat for `conversation`, `listing`, `qualified_lead`, `system_config`.

### TC-AUD-003: Filter by action

**Priority:** P1
**Roles:** owner

**Steps:**
1. Filter action = *qualification_change*.

**Expected result:**
- Only qualification change rows.
- Repeat for `create`, `update`, `delete`, `status_change`, `bot_toggle`, `message_sent`, `consent_captured`, `consent_auto_captured`, `opt_out_captured`, `template_send_blocked`.

### TC-AUD-004: Filter by source

**Priority:** P2
**Roles:** owner

**Steps:**
1. Filter source = *system*.

**Expected result:**
- Only entries with no human user (background tasks, triggers).

### TC-AUD-005: Search by entity ID

**Priority:** P2
**Roles:** owner

**Steps:**
1. Search a known lead ID.

**Expected result:**
- All entries for that lead.

### TC-AUD-006: Search by user ID / name

**Priority:** P2
**Roles:** owner

**Steps:**
1. Search by user display name.

**Expected result:**
- All actions performed by that user.

### TC-AUD-007: `onLeadWritten` audit entry

**Priority:** P0
**Roles:** owner

**Steps:**
1. Edit a lead's `qualificationStatus`.

**Expected result:**
- `onLeadWritten` trigger writes a `qualification_change` entry with previous + new value.

### TC-AUD-008: `onConversationWritten` audit entry

**Priority:** P0
**Roles:** owner

**Steps:**
1. Toggle a conversation's bot.

**Expected result:**
- Audit entry `bot_toggle`.

### TC-AUD-009: `onListingWritten` audit entry

**Priority:** P0
**Roles:** owner

**Steps:**
1. Deactivate a listing with closure reason.

**Expected result:**
- Audit entry `status_change` with closure reason in payload.

### TC-AUD-010: `onConfigWritten` audit entry

**Priority:** P0
**Roles:** owner

**Steps:**
1. Change `botConfig.activeStyleId`.

**Expected result:**
- Audit entry written; cache invalidation also happens.

### TC-AUD-011: Impersonation actions logged with original UID

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. While impersonating, perform any allowed read (or an emergency write if granted).

**Expected result:**
- Audit entry captures both the impersonated UID and the original admin UID.

### TC-AUD-012: Cross-tenant audit isolation

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Try to fetch audit logs from Org B.

**Expected result:**
- Firestore rules deny.

### TC-AUD-013: Audit log volume

**Priority:** P2
**Roles:** owner
**Preconditions:** High-volume org with 10k+ entries.

**Steps:**
1. Apply filters and search.

**Expected result:**
- Queries remain responsive (≤2s).
- Pagination or cursor-based loading.

---

## 14. WhatsApp Integration (`WA`)

Covers `functions/src/services/twilioClient.ts`, `cloudApiClient.ts`, `messagingProvider.ts`, `embeddedSignup.ts`, `twilioOnboarding.ts`, plus the webhooks (`webhook`, `whatsappWebhook`) and template management endpoints. Two providers: Twilio Tech Provider (default) and Meta Cloud API (admin-only).

### TC-WA-001: Inbound webhook (Twilio) — happy path

**Priority:** P0
**Roles:** automated

**Steps:**
1. Send an inbound WhatsApp message from tester device.

**Expected result:**
- `webhook` cloud function receives Twilio POST.
- Auth token validated.
- `addPendingMessage` buffers the message by `chatId`.
- `processBuffer` task launched async.
- Conversation doc created or updated under correct `organizationId` (auto-discovered from phone number).

### TC-WA-002: Inbound webhook (Twilio) — auth token missing/invalid

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to `webhook` without Twilio auth.

**Expected result:**
- Request rejected with 401 or 403.

### TC-WA-003: Inbound webhook (Cloud API) — GET challenge

**Priority:** P0
**Roles:** Meta

**Steps:**
1. Meta sends GET `whatsappWebhook?hub.mode=subscribe&hub.verify_token={META_VERIFY_TOKEN}&hub.challenge=abc123`.

**Expected result:**
- Function returns 200 with body `abc123`.
- Token mismatch returns 403.

### TC-WA-004: Inbound webhook (Cloud API) — POST message

**Priority:** P0
**Roles:** Meta

**Steps:**
1. Send a real inbound from tester device to a Cloud API number.

**Expected result:**
- `parseCloudApiWebhook` parses the payload.
- Message routed into the same buffer pipeline.
- Org resolved from `phoneNumberId` mapping.

### TC-WA-005: Inbound webhook — delivery / read receipts

**Priority:** P1
**Roles:** automated

**Steps:**
1. Send an outbound; observe receipts coming back.

**Expected result:**
- Receipts logged; conversation doc updated (delivered, read timestamps).

### TC-WA-006: Outbound text — Twilio

**Priority:** P0
**Roles:** owner

**Steps:**
1. Call `sendMessage` for a chat within the 24h window.

**Expected result:**
- `twilioClient.sendText` invoked.
- Tester device receives message.

### TC-WA-007: Outbound text — Cloud API

**Priority:** P0
**Roles:** owner
**Preconditions:** Org on Cloud API.

**Steps:**
1. Call `sendMessage`.

**Expected result:**
- `cloudApiClient.sendText` invoked.
- Tester device receives.

### TC-WA-008: Template send — Twilio

**Priority:** P0
**Roles:** automated

**Steps:**
1. Trigger a qualified-lead notification (which uses `agentNotification` template).

**Expected result:**
- `twilioClient.sendTemplate` invoked with the right Content SID and variables.
- Tester device receives template message.
- `renderTwilioTemplateBody` correctly substitutes variables.

### TC-WA-009: Template send — Cloud API

**Priority:** P0
**Roles:** automated

**Steps:**
1. Same as TC-WA-008 on a Cloud API org.

**Expected result:**
- `cloudApiClient.sendTemplate` invoked.

### TC-WA-010: 24h window — outside fallback to template

**Priority:** P0
**Roles:** owner

**Steps:**
1. Attempt to send plain text when last inbound was >24h ago.

**Expected result:**
- Free-form send fails (`isTwilioOutside24hWindowError`).
- Auto-fallback to `returningLeadEs`/`returningLeadEn` template.

### TC-WA-011: 24h window — inside, free-form succeeds

**Priority:** P0
**Roles:** owner

**Steps:**
1. Tester sends inbound; within 24h, agent sends free-form.

**Expected result:**
- `isLikelyWhatsAppCustomerCareWindowOpenForRecipient` returns true.
- Free-form delivered.

### TC-WA-012: Reply buttons (Cloud API only)

**Priority:** P1
**Roles:** automated

**Steps:**
1. Trigger a flow that uses `cloudApiClient.sendReplyButtons` (e.g. yes/no consent prompt).

**Expected result:**
- Buttons render in WhatsApp on tester device.
- Tapping a button delivers a reply with button payload.

### TC-WA-013: Provider routing — global default

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Set global policy: `defaultProvider = "twilio"`.
2. Inspect any org without override.

**Expected result:**
- `getEffectiveProviderForOrg` returns Twilio.

### TC-WA-014: Provider routing — org override

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Set `setOrgMessagingProvider(orgB, "cloud_api")`.

**Expected result:**
- Org B uses Cloud API regardless of global default.
- `clearOrgMessagingProviderOverride` reverts.

### TC-WA-015: Provider cache invalidation

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Change provider override; observe next outbound.

**Expected result:**
- `invalidateProviderCache(orgId)` ensures the next call picks the new provider without process restart.

### TC-WA-016: Template creation — Twilio

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Call `createTwilioTemplates` with all three templates: `agentNotification`, `idealistaInitial`, `callHandoff`.

**Expected result:**
- Templates created in Twilio.
- Each submitted to Meta via `submitContentForWhatsAppApproval` with **category MARKETING** per [[project_whatsapp_template_category]].
- Approval status starts `pending`.

### TC-WA-017: Template creation — Cloud API

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Call `createCloudApiTemplates` with templates list.

**Expected result:**
- `createMessageTemplate` in Meta Graph API succeeds.
- Templates listed in WABA's template manager with category **MARKETING**.

### TC-WA-018: Template approval polling

**Priority:** P1
**Roles:** automated

**Steps:**
1. After submission, poll `fetchContentApprovalStatus`.

**Expected result:**
- Status transitions: `pending` → `approved` (or `rejected`).
- Approved templates become sendable.

### TC-WA-019: Cloud API health check

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Call `cloudApiHealthCheck`.

**Expected result:**
- Returns ok if credentials + webhook are valid.
- Returns specific failure if `accessTokenSecretName` cannot be read, webhook subscription missing, or phone number invalid.

### TC-WA-020: Sync recovery — missed inbound

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Cause an inbound to be missed (e.g. simulate Cloud Function downtime).
2. Wait for `syncConversationsTask` (every 2 min).

**Expected result:**
- Task polls Twilio/Meta API for messages since last cursor.
- Missed messages inserted into Firestore.

### TC-WA-021: Failed outbound retry

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Cause a transient send failure (e.g. rate-limit).
2. Confirm it lands in failed-message queue (`addFailedMessage`).
3. Wait for `retryFailedMessagesTask`.

**Expected result:**
- Retry succeeds; message removed from queue.
- After max attempts, message moved to dead-letter and an alert fires.

### TC-WA-022: Ignore chat

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Call `ignoreChatForSync` for a chatId.

**Expected result:**
- `isChatIgnored` returns true.
- Future sync passes skip this chat.

### TC-WA-023: WhatsApp profile photo upload

**Priority:** P1
**Roles:** owner

**Steps:**
1. Upload an assistant photo (from onboarding or settings).

**Expected result:**
- `setWhatsAppProfilePhoto` updates the WABA profile.
- Tester's WhatsApp shows the new avatar within minutes.

### TC-WA-024: waRedirect deep-link

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Open `/waRedirect?listingCode=ABC-001` (or equivalent param).

**Expected result:**
- 302 to `https://wa.me/{number}?text=...`.
- Text prefills listing reference.

### TC-WA-025: Embedded signup config endpoint

**Priority:** P0
**Roles:** frontend

**Steps:**
1. GET `getEmbeddedSignupConfig`.

**Expected result:**
- Returns `META_APP_ID` and `META_FB_LOGIN_CONFIG_ID`.

### TC-WA-026: Exchange embedded signup code — happy path

**Priority:** P0
**Roles:** automated

**Steps:**
1. After Meta OAuth, frontend posts code to `exchangeEmbeddedSignupCode`.

**Expected result:**
- `exchangeCodeForToken` swaps code for access token.
- `storeAccessTokenInSecretManager` stores token in GCP Secret Manager.
- `subscribeAppToWaba` runs.
- `persistCloudApiConfigForOrg` saves config.

### TC-WA-027: Exchange embedded signup — bad code

**Priority:** P1
**Roles:** automated

**Steps:**
1. Replay with a tampered code.

**Expected result:**
- Meta returns error; function returns 400 with sanitized message.

### TC-WA-028: setManualCloudApiConfig fallback

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Manually set Cloud API config via admin endpoint when embedded signup fails.

**Expected result:**
- Token stored, config persisted, webhook subscribed.

### TC-WA-029: Opt-out — STOP keyword

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Send `STOP`.

**Expected result:**
- `isOptOutMessage` detects.
- `applyOptOut` marks conversation.
- Bot does not reply.

### TC-WA-030: Opt-out — Spanish variants

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Send variants: `BAJA`, `CANCELAR`, `NO ME ESCRIBAS`.

**Expected result:**
- Detected as opt-out (or document which keywords are recognized; flag follow-up if Spanish list incomplete).

### TC-WA-031: Template category check (regression)

**Priority:** P0
**Roles:** automated

**Steps:**
1. Inspect `createTwilioTemplates` and `createCloudApiTemplates` request payloads.

**Expected result:**
- Each template submitted with `category: "MARKETING"` ([[project_whatsapp_template_category]]).
- No template uses UTILITY or AUTHENTICATION.

---

## 15. Cross-Org Call Handoff (`CALL`)

Covers `voiceWebhook`, `voiceGatherCallback`, `outboundCallRetryTask`, `outboundConsentVoiceWebhook`, `outboundConsentGatherCallback`, `outboundConsentStatusCallback`, `sendCallHandoffMessage`, `processCallNameTimeout`, `recordCallHandoffEvent`, `callHandoffReadiness`.

### TC-CALL-001: Inbound IVR — happy path

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. From tester device, call the global intake number.
2. Listen to IVR prompt.
3. Press DTMF for listing code.

**Expected result:**
- `voiceWebhook` parses Twilio call payload.
- `voiceGatherCallback` captures DTMF.
- Listing resolved; target org identified.

### TC-CALL-002: Inbound IVR — invalid DTMF

**Priority:** P1
**Roles:** lead phone

**Steps:**
1. Press random digits.

**Expected result:**
- Prompt re-played up to N retries.
- After max retries, fallback message and call ends gracefully.

### TC-CALL-003: Outbound consent call — happy path

**Priority:** P0
**Roles:** automated
**Preconditions:** Idealista lead intake requested via `newLeadCallConsent`.

**Steps:**
1. Tester answers.
2. Hears ElevenLabs-generated voice prompt asking for consent.
3. Presses `1` to accept.

**Expected result:**
- `outboundConsentGatherCallback` records consent.
- `setLeadConsent` writes proof on lead with `source: "phone_call"`.
- `outboundConsentStatusCallback` records call completion.
- Audit log entry written (`consent_captured`).

### TC-CALL-004: Outbound consent — deny

**Priority:** P0
**Roles:** automated

**Steps:**
1. Tester presses `2` (decline).

**Expected result:**
- Consent not recorded.
- Lead marked as opted-out for WA marketing (or skipped, per design).
- No follow-up SMS / WhatsApp marketing sent.

### TC-CALL-005: Outbound consent — no answer

**Priority:** P1
**Roles:** automated

**Steps:**
1. Tester does not answer.

**Expected result:**
- Status callback shows `no-answer`.
- `outboundCallRetryTask` schedules a retry with exponential backoff.
- After max retries, lead processed without consent (or flagged).

### TC-CALL-006: Outbound consent — busy/failed

**Priority:** P1
**Roles:** automated

**Steps:**
1. Force a `busy` or `failed` Twilio status.

**Expected result:**
- Retry logic kicks in same as TC-CALL-005.

### TC-CALL-007: ElevenLabs voice generation

**Priority:** P1
**Roles:** automated

**Steps:**
1. Trigger an outbound consent call.

**Expected result:**
- `generateSpeechMp3` returns audio.
- Tester hears natural-sounding Spanish voice.

### TC-CALL-008: Cross-org call handoff message

**Priority:** P0
**Roles:** automated
**Preconditions:** Lead on global intake mentions a listing or agent that maps to Org B.

**Steps:**
1. Bot identifies the cross-org match.
2. `recordCallHandoffEvent` logs the handoff intent.
3. `sendCallHandoffMessage` sends the handoff message to Org B's WABA.

**Expected result:**
- Lead now appears in Org B's `/conversaciones` (multi-tenant, [[feedback_chatid_not_org_owned]]).
- Org A's conversation marked with `handoff` metadata.
- Audit log entries in both orgs.

### TC-CALL-009: callHandoffReadiness check

**Priority:** P0
**Roles:** automated

**Steps:**
1. Call `callHandoffReadiness?orgId=orgB`.

**Expected result:**
- Returns ready if Org B has: Cloud API or Twilio config, verified notification number, approved `callHandoff` template.
- Returns not-ready with reason otherwise.

### TC-CALL-010: Name confirmation timeout

**Priority:** P1
**Roles:** automated

**Steps:**
1. Trigger a cross-org match that requires lead to confirm name.
2. Lead does not respond within window.

**Expected result:**
- `processCallNameTimeout` fires; conversation marked with `handoff.status: "timeout"`.
- Optional follow-up message sent.

### TC-CALL-011: Same phone — parallel handoffs into different orgs

**Priority:** P0
**Roles:** lead phone (different listings)

**Steps:**
1. Same phone calls global intake twice for different listings in different orgs.

**Expected result:**
- Each handoff produces a separate conversation in its respective org.
- No cross-org leakage.

### TC-CALL-012: Voice webhook signature/auth

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to `voiceWebhook` without Twilio signature.

**Expected result:**
- Rejected.

---

## 16. AI / OpenAI Features (`AI`)

Covers `functions/src/services/openaiClient.ts` and consumers (`processBuffer`, `analyzeLeadsAgent`, `botTestResolveListing`).

### TC-AI-001: AI auto-reply within window

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Send an inbound asking about a listing.

**Expected result:**
- `generateAssistantResponse` returns a Spanish reply matching the bot style.
- Reply delivered via WhatsApp.
- Conversation history appended.

### TC-AI-002: Language detection / enforcement

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Send an inbound in English.

**Expected result:**
- `enforceOutboundLanguage` keeps response in English.
- Templates for English (e.g. `idealistaInitialEn`) selected.

### TC-AI-003: Lead summary extraction

**Priority:** P0
**Roles:** scheduled
**Preconditions:** Conversation with explicit income, family size, mortgage approval, visit availability.

**Steps:**
1. Wait for `analyzeLeadsAgent` (or trigger manually).

**Expected result:**
- Lead doc updated with extracted `income`, `paymentMethod`, family size, etc.
- `lastAnalyzedAt` set.

### TC-AI-004: Name extraction

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Conversation includes a phrase like *"Hola, soy María Gómez"*.

**Expected result:**
- `extractClientName` returns `María Gómez`.
- Lead.`name` updated.

### TC-AI-005: Listing resolution from free text

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Lead sends a fuzzy description of a property.
2. Bot calls `decideListingFromCandidates` over active listings.

**Expected result:**
- Returns the right listing with confidence ≥ threshold.
- Confidence below threshold falls back to clarification question.

### TC-AI-006: Listing resolution with agent

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Test `resolveListingWithAgent` via `/botTest`.

**Expected result:**
- Returns the same or higher-confidence resolution.
- Confidence score visible.

### TC-AI-007: Confirm/deny classification

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Bot asks *"¿Tienes hipoteca preaprobada?"*; lead answers *"Sí, ya la tengo"*.

**Expected result:**
- `classifyConfirmDeny` returns `confirm`.
- Lead's `paymentMethod = "Hipoteca"` and mortgage-approved flag set.

### TC-AI-008: Filter evaluation — pass

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Listing requires `minMonthlyIncome: 3000` and `maxPeople: 4`.
2. Lead reports income 4000 and 2 people.

**Expected result:**
- `checkLeadPassesFilters` returns pass.
- Lead becomes qualified.

### TC-AI-009: Filter evaluation — fail

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Lead reports income 1500 (below threshold).

**Expected result:**
- `checkLeadPassesFilters` returns fail.
- Lead becomes rejected.
- Audit log entry written.

### TC-AI-010: Bot style influences tone

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Set bot style to *Formal*; trigger a reply.
2. Switch to *Cercano* and trigger another reply for a different lead.

**Expected result:**
- Tone clearly differs between the two.

### TC-AI-011: BotTest page resolution

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open `/botTest`.
2. Submit a property description.

**Expected result:**
- Page shows candidate listings with confidence scores.

### TC-AI-012: OpenAI rate-limit handling

**Priority:** P1
**Roles:** automated

**Steps:**
1. Simulate OpenAI 429.

**Expected result:**
- Backoff + retry; final fallback to a graceful holding message to the lead.
- Alert fired if persistent.

### TC-AI-013: OpenAI generic error

**Priority:** P1
**Roles:** automated

**Steps:**
1. Simulate OpenAI 500.

**Expected result:**
- Retry; if still failing, log to audit + send alert.

### TC-AI-014: British English translation

**Priority:** P2
**Roles:** scheduled

**Steps:**
1. Call `translateTextToBritishEnglish` with Spanish input.

**Expected result:**
- Output in British English (e.g. *colour*, *neighbourhood*, not US spellings).

### TC-AI-015: Scheduled analyzeLeadsAgent cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Confirm via `gcloud functions logs` that `analyzeLeadsAgent` fires every 6h.

**Expected result:**
- Each run updates `lastAnalyzedAt` on processed leads.

---

## 17. Email & Notifications (`EMAIL`)

Covers `functions/src/services/emailService.ts`, `emailTemplates.ts`, `authTriggers.ts`, `emailPreferenceEndpoints.ts`.

### TC-EMAIL-001: Welcome email on signup

**Priority:** P0
**Roles:** new user

**Steps:**
1. Sign up (TC-AUTH-001).

**Expected result:**
- Welcome email arrives with correct display name.
- Spanish body; soporte@proplead.io listed.
- Both HTML and text variants render correctly in Gmail/Outlook.

### TC-EMAIL-002: Team invitation email

**Priority:** P0
**Roles:** invitee

**Steps:**
1. Receive invite from TC-ORG-002.

**Expected result:**
- Subject mentions agency name.
- Body includes role and CTA link `/invite?token=...`.
- Expiry note included.

### TC-EMAIL-003: Password reset email

**Priority:** P0
**Roles:** user

**Steps:**
1. Trigger TC-AUTH-009.

**Expected result:**
- Email with reset link including `oobCode`.
- Token-bound; expires.

### TC-EMAIL-004: Low balance notification

**Priority:** P0
**Roles:** owner

**Steps:**
1. Drop balance below threshold.

**Expected result:**
- Email arrives with current balance + CTA to top up.
- Only sent once per threshold crossing (no spam loop).

### TC-EMAIL-005: Payment failed notification

**Priority:** P0
**Roles:** owner

**Steps:**
1. Trigger `invoice.payment_failed` (TC-SUB-018).

**Expected result:**
- Email arrives with amount, retry CTA, link to billing portal.

### TC-EMAIL-006: Support inquiry confirmation

**Priority:** P2
**Roles:** any

**Steps:**
1. Submit a support inquiry through the UI (if exposed) or by calling `sendSupportInquiryNotification`.

**Expected result:**
- Confirmation email to user.

### TC-EMAIL-007: New signup admin alert

**Priority:** P1
**Roles:** automated

**Steps:**
1. Each new signup (TC-AUTH-001).

**Expected result:**
- Internal admin alert email arrives at the Proplead support inbox.

### TC-EMAIL-008: testEmailTemplates renders all variants

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. POST to `testEmailTemplates`.

**Expected result:**
- All templates render HTML + text without errors.
- Variable substitution correct.

### TC-EMAIL-009: Unsubscribe link works

**Priority:** P0
**Roles:** any

**Steps:**
1. Click the unsubscribe link in any marketing email.

**Expected result:**
- Routes to `/email-preferences?t=...`.
- Token validated; preference toggled.
- Confirmation page renders.

### TC-EMAIL-010: Email preferences API round-trip

**Priority:** P1
**Roles:** any

**Steps:**
1. Toggle unsubscribed in API; confirm via subsequent fetch.

**Expected result:**
- State persisted.
- Re-subscription works.

### TC-EMAIL-011: Sender domain / SPF / DKIM

**Priority:** P1
**Roles:** infrastructure

**Steps:**
1. Inspect headers of received emails.

**Expected result:**
- SPF pass.
- DKIM pass.
- Return-Path matches expected domain.

### TC-EMAIL-012: HTML accessibility

**Priority:** P2
**Roles:** any

**Steps:**
1. Open emails in dark mode and on mobile (Apple Mail, Gmail iOS).

**Expected result:**
- Readable on both.
- Buttons reach minimum touch target.

### TC-EMAIL-013: testWelcomeEmail script

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Run `sendTestWelcomeEmail` script.

**Expected result:**
- Sends to target email; no production user is impacted.

---

## 18. Legal & Compliance (`LEGAL`)

Per [[project_legal_stack_v1]]: 12 legal docs completed May 2026 (T&C, Privacy, DPA, Cookies, AUP, Subprocessors); UK entity, England & Wales law, 3-month liability cap, soporte@proplead.io, GA4+Meta+Google Ads confirmed, EU Rep pending.

### TC-LEGAL-001: All 12 legal docs reachable

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Visit each: `/legal/terms`, `/legal/privacy-policy`, `/legal/data-deletion`, `/legal/cookies`, `/legal/aup`, `/legal/dpa`, `/aviso-legal`, plus any subprocessors / EU rep page.

**Expected result:**
- All render; HTTP 200.
- Footer link on `/` reaches each.

### TC-LEGAL-002: Versioned consent at signup

**Priority:** P0
**Roles:** new user

**Steps:**
1. Sign up.

**Expected result:**
- `userConsents/{uid}` doc:
  - `legal: true`
  - `marketing: <true|false>`
  - Versions: `terms: "1.0"`, `privacy: "1.0"`, `dpa: "1.0"`
  - `capturedAt: Timestamp`.

### TC-LEGAL-003: Marketing consent optional

**Priority:** P0
**Roles:** new user

**Steps:**
1. Sign up without ticking marketing.

**Expected result:**
- `userConsents.marketing: false`.
- No marketing emails sent until consented.

### TC-LEGAL-004: WhatsApp inbound auto-consent

**Priority:** P0
**Roles:** lead phone

**Steps:**
1. Receive a brand-new inbound from a previously unknown lead.

**Expected result:**
- `ensureInboundWhatsAppConsentByChatId` marks lead with consent: `source: "inbound_whatsapp"`, `capturedAt`.
- Audit log entry `consent_auto_captured` written.

### TC-LEGAL-005: Explicit consent via setLeadConsent

**Priority:** P0
**Roles:** automated

**Steps:**
1. Call `setLeadConsent` with `source: "idealista_form"`, `language: "es"`, `proofUrl: "https://.../proof.pdf"`.

**Expected result:**
- Lead's `consent` object set with all fields.
- `consent_captured` audit entry written.

### TC-LEGAL-006: Consent proof upload

**Priority:** P0
**Roles:** admin

**Steps:**
1. Upload a 1 MiB PDF proof to `/organizations/{orgId}/consent-proofs/{leadId}/proof.pdf`.

**Expected result:**
- Upload succeeds (Storage rule allows ≤10 MiB, image/PDF).
- `lead.consent.proofUrl` set.

### TC-LEGAL-007: Consent proof — over size

**Priority:** P0
**Roles:** admin

**Steps:**
1. Try to upload 11 MiB file.

**Expected result:**
- Storage rule rejects.

### TC-LEGAL-008: Consent proof — wrong MIME

**Priority:** P0
**Roles:** admin

**Steps:**
1. Try to upload `.exe` or `.zip`.

**Expected result:**
- Rejected.

### TC-LEGAL-009: Meta Data Deletion Request — webhook

**Priority:** P0
**Roles:** Meta

**Steps:**
1. Meta sends the Data Deletion Request webhook for a user.

**Expected result:**
- Function creates a doc under `dataDeletionRequests/{code}` with `status: "pending"` and metadata.
- Returns the public URL `https://proplead.io/legal/deletion-status?code={code}` per Meta spec.

### TC-LEGAL-010: Data Deletion status updates

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. After `purgeDeletedOrganizations` deletes the user's data.

**Expected result:**
- `dataDeletionRequests/{code}.status: "deleted"`.
- DeletionStatus page reflects this.

### TC-LEGAL-011: GDPR data export

**Priority:** P0
**Roles:** owner

**Steps:**
1. Trigger TC-CFG-003.

**Expected result:**
- Export contains all PII, conversations, leads, listings.
- No internal-only fields (e.g. raw access tokens).

### TC-LEGAL-012: Org soft-delete grace 30 days

**Priority:** P0
**Roles:** owner

**Steps:**
1. Delete org (TC-CFG-004).
2. Verify data still in Firestore (with `deletedAt` set) for 30 days.

**Expected result:**
- Members lose access immediately.
- Data physically purged only after grace.

### TC-LEGAL-013: Cookies consent gates GA4/Meta/Google Ads

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Visit `/` without consent.
2. Inspect Network for GA4, Meta Pixel, Google Ads.

**Expected result:**
- None fire pre-consent.
- After accept-all (TC-LAND-019), all fire.
- After reject-all (TC-LAND-020), none fire.

### TC-LEGAL-014: EU representative listing (pending)

**Priority:** P2
**Roles:** unauthenticated

**Steps:**
1. Check the Privacy Policy / Subprocessors doc for EU rep mention.

**Expected result:**
- Either present (with name + address) OR clearly marked *"EU representative pending"*.

**Notes:** Track in project memory until resolved.

### TC-LEGAL-015: 3-month liability cap visible in T&C

**Priority:** P1
**Roles:** unauthenticated

**Steps:**
1. Search `/legal/terms` for liability cap clause.

**Expected result:**
- Clause clearly states 3-month cap.

### TC-LEGAL-016: Support email correctness

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Search all legal docs and footer for `soporte@proplead.io`.

**Expected result:**
- Consistent everywhere — no legacy `support@…` addresses.

### TC-LEGAL-017: `userConsents` immutability

**Priority:** P0
**Roles:** authenticated

**Steps:**
1. Sign up.
2. Try to overwrite the existing `userConsents/{uid}` doc.

**Expected result:**
- Firestore rules reject the update.
- A new consent capture would require a separate doc / versioned write per design.

---

## 19. Internal / Lab & Admin Pages (`ADMIN`)

Covers super-admin-only routes: `/onboards`, `/admin/tools`, `/admin/twilio-migration`, `/botTest`, `/fonts`, `/email-templates`, `/_internal/whatsapp-animation-lab`, `/_internal/whatsapp-leads-animation`, `/usuarios`.

### TC-ADMIN-001: Route gating — each role denied except super_admin

**Priority:** P0
**Roles:** owner / admin / member / agent

**Steps:**
1. Navigate to each admin route.

**Expected result:**
- Non-super-admins denied. Admin allowed only to `/admin/twilio-migration` per route table; confirm.

### TC-ADMIN-002: `/onboards` lists onboarding state across orgs

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Open `/onboards`.

**Expected result:**
- Table of orgs with onboarding step, last activity, WhatsApp connection status.

### TC-ADMIN-003: `/admin/tools` loads utilities

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Open `/admin/tools`.

**Expected result:**
- Utilities such as: clear caches, run backfills (`backfill_agent_scope`, `backfill_conversation_tags`, `backfill_notification_numbers`), trigger `analyzeLeadsAgent`, seed messaging policy.

### TC-ADMIN-004: `/admin/twilio-migration`

**Priority:** P0
**Roles:** super_admin / admin

**Steps:**
1. Open `/admin/twilio-migration` (covered in detail in `MIG`).

**Expected result:**
- Migration jobs listed; controls available.

### TC-ADMIN-005: `/botTest`

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open `/botTest`.

**Expected result:**
- Form for description; on submit, returns candidate listings with scores.

### TC-ADMIN-006: `/fonts`

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open `/fonts`.

**Expected result:**
- Renders font stacks for QA.

### TC-ADMIN-007: `/email-templates`

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open `/email-templates`.

**Expected result:**
- Renders all email templates with sample data.

### TC-ADMIN-008: `/_internal/whatsapp-animation-lab`

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open the route.

**Expected result:**
- Animation showcase renders. No console errors.

### TC-ADMIN-009: `/_internal/whatsapp-leads-animation`

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Open the route.

**Expected result:**
- Animation showcase renders.

### TC-ADMIN-010: `/usuarios` user search

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Open `/usuarios`.
2. Search by email and by UID.

**Expected result:**
- Matches displayed with last access.
- Impersonate action available.

### TC-ADMIN-011: backfillPerOrgTemplateEligibility

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Invoke `backfillPerOrgTemplateEligibility`.

**Expected result:**
- Scans all orgs; updates eligibility flags.
- Idempotent on rerun.

### TC-ADMIN-012: seedGlobalMessagingPolicy

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Run on a fresh deployment.

**Expected result:**
- Global messaging policy doc created with safe defaults.
- Subsequent runs no-op.

---

## 20. Twilio Sender Migration (`MIG`)

Covers `functions/src/services/twilioMigration.ts`, `startTwilioSenderMigration`, `pollTwilioMigrationJob`, `forceCompleteTwilioMigrationJob`, `retryTwilioMigrationStep`, `pollPendingTwilioMigrations`, `submitTwilioMigrationTemplates`, and the UI at `/admin/twilio-migration`.

### TC-MIG-001: Start migration for org

**Priority:** P0
**Roles:** super_admin / admin
**Preconditions:** Org currently on shared Twilio account.

**Steps:**
1. Open `/admin/twilio-migration`.
2. Click **Iniciar migración** for the target org.

**Expected result:**
- `startTwilioSenderMigration` invoked.
- `twilioMigrationJobs/{jobId}` doc created with `step: "create_subaccount"`.

### TC-MIG-002: create_subaccount step

**Priority:** P0
**Roles:** automated

**Steps:**
1. Wait for the first step to run.

**Expected result:**
- Twilio subaccount created via `createSubaccount`.
- Job doc advances to `step: "create_sender"`.

### TC-MIG-003: create_sender step

**Priority:** P0
**Roles:** automated

**Steps:**
1. After subaccount creation.

**Expected result:**
- WhatsApp sender created in subaccount.
- Job advances to `poll_sender_active`.

### TC-MIG-004: poll_sender_active

**Priority:** P0
**Roles:** automated

**Steps:**
1. Wait for sender to come online.

**Expected result:**
- `pollSenderUntilOnline` returns ACTIVE within Twilio's typical window.
- Job advances to `clone_templates`.

### TC-MIG-005: clone_templates

**Priority:** P0
**Roles:** automated

**Steps:**
1. Templates cloned from `PROPLEAD_TEMPLATE_SOURCE_ORG`.

**Expected result:**
- All required templates exist in the new subaccount.
- Job advances to `submit_for_approval`.

### TC-MIG-006: submit_for_approval

**Priority:** P0
**Roles:** automated

**Steps:**
1. Templates submitted to Meta with category **MARKETING**.

**Expected result:**
- Meta returns submission IDs.
- Job advances to `configure_webhook`.

### TC-MIG-007: configure_webhook

**Priority:** P0
**Roles:** automated

**Steps:**
1. Webhook configured on the new sender.

**Expected result:**
- `configureWhatsAppSenderWebhook` succeeds.
- Job marked complete.
- Org's `botConfig.twilioConfig` updated.

### TC-MIG-008: Step failure — retry

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Simulate a failure on `clone_templates` (e.g. revoke API key briefly).
2. Restore key.
3. Click **Reintentar paso** on the job.

**Expected result:**
- `retryTwilioMigrationStep` re-runs that step.
- Job advances on success.

### TC-MIG-009: Force complete

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. With a stuck job, click **Marcar como completado**.

**Expected result:**
- `forceCompleteTwilioMigrationJob` writes completion state.
- Subsequent polls do not revert.

### TC-MIG-010: Scheduled polling

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Leave a job in flight; do not interact for 30+ minutes.

**Expected result:**
- `pollPendingTwilioMigrations` progresses the job automatically.

### TC-MIG-011: Mid-migration messaging continuity

**Priority:** P0
**Roles:** owner

**Steps:**
1. During migration, send/receive a WhatsApp message.

**Expected result:**
- Messages continue to flow through the old config until cutover.
- Post-cutover, traffic flows on new sender.

### TC-MIG-012: UI reflects job state in real-time

**Priority:** P1
**Roles:** super_admin

**Steps:**
1. Watch the migration UI as a job runs.

**Expected result:**
- Step transitions visible within a few seconds.
- Status badge updates colors per step.

### TC-MIG-013: Cross-tenant migration isolation

**Priority:** P0
**Roles:** super_admin

**Steps:**
1. Migrate Org A; confirm Org B unaffected.

**Expected result:**
- Org B's existing Twilio config untouched.

### TC-MIG-014: Migration with no source templates

**Priority:** P2
**Roles:** super_admin

**Steps:**
1. Run with a misconfigured `PROPLEAD_TEMPLATE_SOURCE_ORG`.

**Expected result:**
- Job fails at `clone_templates` with a clear error.

---

## 21. Notification Numbers Verification (`NOTIF`)

Covers `functions/src/services/notificationNumbersService.ts`, `twilioVerify.ts`, the verification endpoints, and the resolution logic in `qualifiedLeadNotificationTargets.ts`.

### TC-NOTIF-001: Add new number — SMS OTP delivered

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open the notification numbers panel.
2. Click **Añadir número**.
3. Enter `+34600000003`.
4. Choose channel SMS; submit.

**Expected result:**
- `startNotificationNumberVerification` called.
- `upsertPendingNumber` creates doc with `verificationStatus: "pending"`.
- SMS arrives at tester device within 30s.

### TC-NOTIF-002: Correct OTP marks verified

**Priority:** P0
**Roles:** owner

**Steps:**
1. Enter OTP.

**Expected result:**
- `checkNotificationNumberVerification` validates.
- `markVerified` updates doc: `verified: true`, `verificationStatus: "approved"`, `verifiedAt`.
- Phone digests stored for dedupe.

### TC-NOTIF-003: E.164 normalization

**Priority:** P0
**Roles:** owner

**Steps:**
1. Enter `600 000 003` (no country code) in a Spain-default UI.

**Expected result:**
- `normalizeToE164` converts to `+34600000003` before sending.

### TC-NOTIF-004: Wrong OTP increments attempts

**Priority:** P0
**Roles:** owner

**Steps:**
1. Enter wrong OTP twice.

**Expected result:**
- `incrementVerificationAttempts` runs.
- Error shows remaining attempts.

### TC-NOTIF-005: Lockout after max attempts

**Priority:** P1
**Roles:** owner

**Steps:**
1. Enter wrong OTP N+1 times.

**Expected result:**
- Verification locked; user prompted to wait or resend.

### TC-NOTIF-006: Expired OTP

**Priority:** P1
**Roles:** owner

**Steps:**
1. Wait >10 minutes after issuing OTP.
2. Enter the code.

**Expected result:**
- Backend returns expired error; UI surfaces Spanish error.

### TC-NOTIF-007: Rate limit

**Priority:** P1
**Roles:** owner

**Steps:**
1. Request OTP 5 times in 60 seconds.

**Expected result:**
- `isTwilioVerifyRateLimited` returns true on the 5th.
- UI shows wait period.

### TC-NOTIF-008: Voice channel verification

**Priority:** P1
**Roles:** owner

**Steps:**
1. Choose channel **Llamada** instead of SMS.

**Expected result:**
- Twilio Verify calls the number; voice reads the OTP.
- Enter OTP completes verification.

### TC-NOTIF-009: Duplicate number — different label

**Priority:** P2
**Roles:** owner

**Steps:**
1. Add a number already verified for the same org.

**Expected result:**
- `findByPhoneDigests` detects duplicate; offers to relabel rather than create new doc.

### TC-NOTIF-010: Delete number

**Priority:** P0
**Roles:** owner

**Steps:**
1. Delete a verified number.

**Expected result:**
- `deleteNumber` removes doc.
- Listings using that number's ID handle gracefully (fall back to legacy or other numbers).
- Rules allow managers to delete.

### TC-NOTIF-011: Notification routing — per-listing

**Priority:** P0
**Roles:** automated
**Preconditions:** Listing has `notificationNumberIds: [A, B]`.

**Steps:**
1. Trigger a qualified lead on that listing.

**Expected result:**
- `resolveQualifiedLeadNotificationRecipients` returns [A, B].
- WhatsApp template delivered to both numbers.

### TC-NOTIF-012: Notification routing — legacy fallback

**Priority:** P0
**Roles:** automated
**Preconditions:** Listing has no `notificationNumberIds`; `BotConfig.notificationNumbers` set.

**Steps:**
1. Trigger qualified lead.

**Expected result:**
- Legacy numbers used.

### TC-NOTIF-013: Notification routing — env fallback

**Priority:** P1
**Roles:** automated
**Preconditions:** Org has no listing-level or `BotConfig` numbers set but env fallback exists.

**Steps:**
1. Trigger qualified lead.

**Expected result:**
- `resolveOrgNotificationNumbers` falls back to env constant.
- Document this is for emergencies / single-tenant fallback.

### TC-NOTIF-014: Notification routing — empty (no recipients)

**Priority:** P0
**Roles:** automated

**Steps:**
1. Remove all notification sources for an org.

**Expected result:**
- Qualified lead processed but no notification message sent.
- Alert fires (no recipients configured).

### TC-NOTIF-015: Merge agent + org numbers, deduped

**Priority:** P1
**Roles:** automated

**Steps:**
1. Listing has agent numbers + org numbers with one overlap.

**Expected result:**
- `mergeOrgAndAgentRecipients` returns deduped union.
- `normalizePhoneForDedupe` matches different formattings of the same number.

### TC-NOTIF-016: Plan-tier max numbers respected

**Priority:** P0
**Roles:** owner

**Steps:**
1. As `pro_plus`, add up to max numbers; try one more.

**Expected result:**
- Cap enforced server-side per `getMaxListingNotificationNumbers`.

### TC-NOTIF-017: Listing picker shows only verified numbers

**Priority:** P0
**Roles:** owner

**Steps:**
1. In the listing notification picker, view options.

**Expected result:**
- Only `verified: true` numbers selectable.
- Pending numbers either hidden or shown disabled with hint.

### TC-NOTIF-018: Non-manager cannot delete

**Priority:** P0
**Roles:** member

**Steps:**
1. Try to delete a verified number via DevTools/Firestore.

**Expected result:**
- Rule denies.

---

## 22. Mobile Responsiveness (`MOBI`)

Driven by [`docs/mobile-audit-2026-05.md`](../mobile-audit-2026-05.md). Test viewports: **375×667** (iPhone SE), **390×844** (iPhone 14), **414×896** (iPhone 11 Pro Max). Use Chrome DevTools device emulation.

### TC-MOBI-001: `/anuncios` — no 119px overflow (P0)

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/anuncios` at 375×667.
2. Resize horizontal scroll bar (or `body.scrollWidth > window.innerWidth`).

**Expected result (when fixed):**
- Page does not horizontally scroll.
- Action buttons reachable (either collapsed into menu or wrapped).

### TC-MOBI-002: `/suscripcion` — balance card 133px overflow (P0)

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/suscripcion` at 375×667.

**Expected result (when fixed):**
- Conversation balance card fits viewport.

### TC-MOBI-003: `/conversaciones` — message bubble overflow (P0)

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open a conversation containing a long word or URL at 375×667.

**Expected result (when fixed):**
- Bubble wraps; no overflow.

### TC-MOBI-004: `/leads` — state tabs hidden (P0)

**Priority:** P0
**Roles:** owner

**Steps:**
1. Open `/leads` at 375×667.

**Expected result (when fixed):**
- All 5 tabs visible (collapsed dropdown or compact layout).

### TC-MOBI-005: `/landingv2` — hero "desinteresados" clip (P0)

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Open `/` at 375×667.

**Expected result (when fixed):**
- Hero h1 fully visible.

### TC-MOBI-006: P1 — form inputs responsive

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/anuncios` create modal at 390×844.

**Expected result:**
- All inputs full-width or wrapped sensibly.
- No clipped labels.

### TC-MOBI-007: P1 — sidebar collapse

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/dashboard` at 375×667.
2. Open hamburger menu.

**Expected result:**
- Sidebar slides in over content.
- Backdrop dim; tap closes menu.

### TC-MOBI-008: P1 — modal sizing

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open Lead edit modal on mobile.

**Expected result:**
- Modal occupies near full screen; close button reachable.

### TC-MOBI-009: P1 — card stacking

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/dashboard` at 375×667.

**Expected result:**
- KPI tiles stack vertically.

### TC-MOBI-010: P2 — spacing/padding

**Priority:** P2
**Roles:** any

**Steps:**
1. Spot-check standard pages at 375×667 for crowded UI.

**Expected result:**
- Adequate breathing room.

### TC-MOBI-011: P2 — font size scaling

**Priority:** P2
**Roles:** any

**Steps:**
1. Set iOS dynamic font size to large; reopen the app.

**Expected result:**
- Text remains readable; no clipping.

### TC-MOBI-012: P2 — color contrast

**Priority:** P2
**Roles:** any

**Steps:**
1. Use Chrome Lighthouse Accessibility audit.

**Expected result:**
- Contrast ratios pass WCAG AA for critical text.

### TC-MOBI-013: Hamburger open/close interaction

**Priority:** P1
**Roles:** owner

**Steps:**
1. Tap hamburger; tap a nav item.

**Expected result:**
- Sidebar opens, item navigates, sidebar closes.

### TC-MOBI-014: Org switcher on mobile

**Priority:** P1
**Roles:** owner (multi-org)

**Steps:**
1. Open org switcher from mobile sidebar.

**Expected result:**
- Dropdown opens with full names visible.

### TC-MOBI-015: Touch targets ≥44×44px

**Priority:** P1
**Roles:** any

**Steps:**
1. Inspect key actions: signin button, modal close, hamburger, tab buttons.

**Expected result:**
- Each ≥44×44 CSS px (per Apple HIG).

### TC-MOBI-016: Lead row tap → edit

**Priority:** P1
**Roles:** owner

**Steps:**
1. Tap a lead row on mobile.

**Expected result:**
- Opens edit modal (or full-screen drawer per design).

### TC-MOBI-017: Conversation thread keyboard

**Priority:** P1
**Roles:** owner

**Steps:**
1. Tap the message input in a conversation on mobile.

**Expected result:**
- Keyboard appears without covering the input.
- Page scrolls so input remains visible.

### TC-MOBI-018: Landscape mode

**Priority:** P2
**Roles:** any

**Steps:**
1. Rotate to landscape on a few pages.

**Expected result:**
- Layout adapts; no critical content hidden.

---

## 23. Security & Access Control (`SEC`)

Covers `firestore.rules`, `storage.rules`, function authorization, multi-tenant isolation, and injection/XSS hardening.

### TC-SEC-001: Firestore rules — `users/{uid}` read

**Priority:** P0
**Roles:** any

**Steps:**
1. As user A, read `users/{uidA}`.
2. As user A, read `users/{uidB}`.

**Expected result:**
- Own read allowed.
- Other user's read denied.

### TC-SEC-002: Firestore rules — `users/{uid}` write cannot escalate role

**Priority:** P0
**Roles:** any non-super-admin

**Steps:**
1. As user A, write `users/{uidA}.role = "super_admin"`.

**Expected result:**
- Denied.

### TC-SEC-003: Firestore rules — `organizations/{orgId}/leads` read

**Priority:** P0
**Roles:** owner / admin / member / agent / cross-org / unauthenticated

**Steps:**
1. Org A members read `organizations/{orgIdA}/leads/{leadId}`.
2. Org B members read same path.
3. Anonymous read.

**Expected result:**
- Org A members allowed (agents may be restricted to assigned leads).
- Others denied.

### TC-SEC-004: Firestore rules — agent restricted to assigned leads

**Priority:** P0
**Roles:** agent

**Steps:**
1. Agent reads a lead not assigned to them (different `assignedAgentUid`).

**Expected result:**
- Denied.

### TC-SEC-005: Firestore rules — agent write restricted

**Priority:** P0
**Roles:** agent

**Steps:**
1. Agent tries to update fields outside the allowed set (notes/tags/name/qualification) on an assigned lead.

**Expected result:**
- Allowed fields succeed; other fields rejected.

### TC-SEC-006: Firestore rules — listings ownership

**Priority:** P0
**Roles:** agent

**Steps:**
1. Agent tries to change `assignedAgentUid` on a listing.

**Expected result:**
- Denied by rules (only managers can change ownership/assignment).

### TC-SEC-007: Firestore rules — notification numbers create

**Priority:** P0
**Roles:** any

**Steps:**
1. From client, try to create a doc at `organizations/{orgId}/notificationNumbers/{id}`.

**Expected result:**
- Denied — only Cloud Functions can create.

### TC-SEC-008: Firestore rules — notification numbers update (manager only, limited fields)

**Priority:** P0
**Roles:** manager

**Steps:**
1. As owner, update `label`, `isOrgDefault`, `updatedAt`.
2. Try to update `verified`.

**Expected result:**
- Label/isOrgDefault allowed.
- `verified` write denied (only Cloud Functions can set).

### TC-SEC-009: Firestore rules — qualified leads (read-only for clients)

**Priority:** P0
**Roles:** owner / agent

**Steps:**
1. Read `organizations/{orgId}/qualifiedLeads/{id}`.
2. Write attempt.

**Expected result:**
- Read allowed for org members.
- Write denied (functions only).

### TC-SEC-010: Firestore rules — audit logs read scoped to org

**Priority:** P0
**Roles:** owner (Org A) / owner (Org B)

**Steps:**
1. Org A reads own auditLogs.
2. Org A reads Org B auditLogs.

**Expected result:**
- Own org allowed; other org denied.

### TC-SEC-011: Firestore rules — twilio migration jobs

**Priority:** P0
**Roles:** super_admin / admin / member

**Steps:**
1. Each role reads `twilioMigrationJobs/{id}`.

**Expected result:**
- Super_admin and admin allowed; member denied.
- Write denied for all (functions only).

### TC-SEC-012: Firestore rules — invitations

**Priority:** P0
**Roles:** manager / member / cross-org

**Steps:**
1. Each role reads, creates, deletes invitations.

**Expected result:**
- Managers in same org allowed.
- Members read only; cross-org denied.

### TC-SEC-013: Firestore rules — user consents immutable

**Priority:** P0
**Roles:** any signed-in

**Steps:**
1. Write a fresh `userConsents/{uid}` doc.
2. Update an existing doc.

**Expected result:**
- Create allowed once.
- Update denied.

### TC-SEC-014: Storage rules — consent proofs (10 MiB image/PDF)

**Priority:** P0
**Roles:** manager / member / anonymous

**Steps:**
1. Manager uploads a 1 MiB JPG → ok.
2. Manager uploads 11 MiB → denied.
3. Manager uploads `.exe` → denied.
4. Member uploads → denied.
5. Anonymous reads → denied.

**Expected result:**
- As above.

### TC-SEC-015: Storage rules — assistant photos (5 MiB JPG/PNG, public read)

**Priority:** P0
**Roles:** manager / anonymous

**Steps:**
1. Manager uploads 4 MiB PNG → ok.
2. Anonymous read of avatar URL → ok.
3. Anonymous write → denied.

**Expected result:**
- As above.

### TC-SEC-016: Storage rules — all other paths denied

**Priority:** P0
**Roles:** any

**Steps:**
1. Try to read/write a random path like `random/file.txt`.

**Expected result:**
- Denied.

### TC-SEC-017: Cloud Function — `newLead` shared-secret check

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to `newLead` without `MAKE_WEBHOOK_SHARED_SECRET`.

**Expected result:**
- 401/403 with no lead created.

### TC-SEC-018: Cloud Function — `whatsappWebhook` Meta verify token

**Priority:** P0
**Roles:** attacker

**Steps:**
1. GET with wrong `hub.verify_token`.

**Expected result:**
- 403; challenge not echoed.

### TC-SEC-019: Cloud Function — `stripeWebhook` signature

**Priority:** P0
**Roles:** attacker

**Steps:**
1. Replay a payload with mutated body.

**Expected result:**
- `constructWebhookEvent` rejects; no side effects.

### TC-SEC-020: Cloud Function — Twilio webhook signature

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to `webhook` and `voiceWebhook` with invalid Twilio signature/auth.

**Expected result:**
- Rejected.

### TC-SEC-021: Cloud Function — admin template token

**Priority:** P0
**Roles:** attacker

**Steps:**
1. POST to template-management endpoints without `ADMIN_TEMPLATE_TOKEN`.

**Expected result:**
- Rejected.

### TC-SEC-022: Cloud Function — auth required on user-context endpoints

**Priority:** P0
**Roles:** unauthenticated

**Steps:**
1. Call `deleteMyOrganization`, `exportMyData`, `createSubscriptionCheckout`, `saveAutoRechargeSettings`, etc. without auth.

**Expected result:**
- 401.

### TC-SEC-023: Impersonation read-only enforcement on server

**Priority:** P0
**Roles:** super_admin (impersonating)

**Steps:**
1. While impersonating, force a write via DevTools-modified request.

**Expected result:**
- Server-side check (in addition to UI) rejects.

### TC-SEC-024: Cross-tenant — user from Org A cannot access Org B

**Priority:** P0
**Roles:** owner (Org A)

**Steps:**
1. Try to fetch any doc path under `organizations/{orgIdB}/...`.

**Expected result:**
- All denied.

### TC-SEC-025: XSS — lead notes rendered safely

**Priority:** P0
**Roles:** owner

**Steps:**
1. Set lead notes to `<img src=x onerror=alert(1)>`.
2. View the lead in `/leads` and `/conversaciones` sidebar.

**Expected result:**
- HTML escaped; no script execution.

### TC-SEC-026: XSS — listing description rendered safely

**Priority:** P0
**Roles:** owner

**Steps:**
1. Set listing description to a script-laden string.

**Expected result:**
- Safely rendered.

### TC-SEC-027: SQL injection / Firestore — no string-built queries

**Priority:** P1
**Roles:** developer

**Steps:**
1. Code review: confirm all Firestore queries use SDK helpers, no string templates.

**Expected result:**
- No SQL-style injection paths exist.

### TC-SEC-028: CSRF — checkout cannot be triggered cross-site

**Priority:** P0
**Roles:** attacker

**Steps:**
1. Try to invoke `createSubscriptionCheckout` from a different origin without proper auth cookies/tokens.

**Expected result:**
- Function uses Firebase Auth token (Bearer header), not cookies, so CSRF impossible without token.

### TC-SEC-029: Secrets — none in client bundle

**Priority:** P0
**Roles:** developer

**Steps:**
1. Inspect built client bundle for strings like `OPENAI_API_KEY`, `TWILIO_AUTH_TOKEN`, `STRIPE_SECRET`, `META_APP_SECRET`.

**Expected result:**
- None present (only the public `META_APP_ID`, `META_FB_LOGIN_CONFIG_ID`, Stripe **publishable** key, Firebase web config).

### TC-SEC-030: Secrets — Secret Manager binding

**Priority:** P0
**Roles:** developer

**Steps:**
1. Confirm `functions/src/secrets.ts` declarations align with deployed `gcloud secrets list`.

**Expected result:**
- Every secret listed in `secrets.ts` exists and is granted to the function's service account.

### TC-SEC-031: Rate limiting on verification

**Priority:** P1
**Roles:** attacker

**Steps:**
1. Brute-force verification OTP.

**Expected result:**
- Twilio Verify + app rate-limit cooperate to block.

### TC-SEC-032: CORS allowlist

**Priority:** P1
**Roles:** attacker

**Steps:**
1. From a non-allowlisted origin, call an endpoint that uses `WEB_CLIENT_CORS`.

**Expected result:**
- Preflight denied.

---

## 24. Performance & Real-time (`PERF`)

Covers listener cleanup, idempotency, large-data behavior, and scheduled task duty cycles.

### TC-PERF-001: Listener cleanup on unmount

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open `/dashboard`, then `/leads`, then `/listings`, then `/conversaciones`.
2. Inspect active Firestore listeners (DevTools network or instrumentation).

**Expected result:**
- Listeners from previous pages are unsubscribed.
- No subscription leak across navigation.

### TC-PERF-002: `/leads` with 700+ rows

**Priority:** P0
**Roles:** owner

**Steps:**
1. Load `/leads` in a seeded org.
2. Scroll bottom; type a search query.

**Expected result (current — known issue):**
- Renders all rows without virtualization; record observed initial render time and any jank.
- File follow-up to add virtualization.

### TC-PERF-003: Initial load on slow 3G

**Priority:** P2
**Roles:** any

**Steps:**
1. Throttle network to Slow 3G in DevTools.
2. Cold-load `/dashboard`.

**Expected result:**
- First paint < 6s.
- Critical content (KPI tiles) populated < 10s.

### TC-PERF-004: Conversation thread with 500+ messages

**Priority:** P1
**Roles:** owner

**Steps:**
1. Open a long thread.

**Expected result:**
- Render under 3s.
- Scroll smooth.

### TC-PERF-005: Auto-recharge concurrency

**Priority:** P0
**Roles:** automated

**Steps:**
1. Concurrently trigger two `runOrgAutoRechargeIfNeeded` calls for the same org.

**Expected result:**
- Only one charge fires (idempotency / lock).

### TC-PERF-006: `deductOrgConversationOnce` idempotency

**Priority:** P0
**Roles:** automated

**Steps:**
1. Call with the same idempotency key twice.

**Expected result:**
- Only one deduction.

### TC-PERF-007: Stripe webhook idempotency

**Priority:** P0
**Roles:** Stripe

**Steps:**
1. Replay the same `event.id`.

**Expected result:**
- `markInvoiceProcessed` blocks double-credit / double-charge.

### TC-PERF-008: Scheduled task — syncConversationsTask cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect Cloud Run / Cloud Scheduler logs.

**Expected result:**
- Runs every 2 min; each run completes within its window.

### TC-PERF-009: retryFailedMessagesTask cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Runs every 5 min.

### TC-PERF-010: checkFollowUps cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Runs hourly.

### TC-PERF-011: analyzeLeadsAgent cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Runs every 6 hours.

### TC-PERF-012: twiceDailyStatusReportTask cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Fires twice daily; once per org per fire.

### TC-PERF-013: purgeDeletedOrganizations cadence

**Priority:** P0
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Runs daily; purges orgs whose `deletedAt` is >30 days old.

### TC-PERF-014: pollPendingTwilioMigrations cadence

**Priority:** P1
**Roles:** scheduled

**Steps:**
1. Inspect logs.

**Expected result:**
- Runs every 30 min; progresses stuck jobs.

### TC-PERF-015: Cold-start tolerance for HTTPS functions

**Priority:** P2
**Roles:** any

**Steps:**
1. Call an HTTPS function after long idle.

**Expected result:**
- Cold-start completes within acceptable budget (Cloud Run targets); no user-visible timeout.

### TC-PERF-016: Webhook throughput

**Priority:** P1
**Roles:** automated

**Steps:**
1. Simulate burst of inbound webhooks (10–20 per second).

**Expected result:**
- All handled; buffer keeps order; no message lost.

### TC-PERF-017: Firestore index health

**Priority:** P1
**Roles:** developer

**Steps:**
1. Inspect Firestore console for missing-index warnings during test cycles.

**Expected result:**
- No missing indexes; all required composite indexes present.

---

## 25. Document maintenance

### 25.1 Update triggers

This document must be updated when any of the following lands on `master`:

- New route added to `src/App.tsx` → add test cases under the relevant area.
- New cloud function exported from `functions/src/index.ts` → add `WA`, `CALL`, `SUB`, `EMAIL`, or `ADMIN` cases as appropriate.
- Role changes (new role, permission shift) → revise `AUTH`, `SEC` and all role matrices.
- Firestore rule changes → revise `SEC`.
- New legal document version → bump `LEGAL_VERSIONS` and add a TC under `LEGAL`.
- Plan-tier / pricing changes → revise `SUB`.
- Mobile audit re-run → revise `MOBI`.

### 25.2 Reviewing this document

A periodic (quarterly) review should:

1. Run a coverage spot-check: pick 5 random source files and confirm at least one test case references each user-visible behavior.
2. Verify each `P0` test still maps to a real business risk; downgrade if not.
3. Re-run all `P0` cases against staging end-to-end as a release readiness gate.
4. Cross-check with `docs/meta-app-review-plan.md` to ensure App Review scope is covered.

### 25.3 Open questions / TODO

The following are intentionally left as open follow-ups for the team:

- **Leads virtualization** (`TC-LEAD-034`, `TC-PERF-002`) — list current behavior is to render 700+ rows raw; needs virtualization.
- **EU representative** (`TC-LEGAL-014`) — pending appointment; update doc when filed.
- **Opt-out Spanish keyword coverage** (`TC-WA-030`) — confirm full Spanish list (`BAJA`, `CANCELAR`, etc.).
- **Restore deleted org during grace** (`TC-CFG-006`) — confirm whether feature exists; if not, file backlog item.
- **Annual proration UX** (`TC-SUB-009`) — verify preview message phrasing in Spanish.
- **Listing code uniqueness enforcement** (`TC-LIST-010`) — confirm server-side validation.

### 25.4 Glossary cross-check

Whenever the data model changes (`functions/src/types.ts`, `src/types/index.ts`), re-check the Glossary in §0.6 for stale terminology.

---

*End of test plan.*
