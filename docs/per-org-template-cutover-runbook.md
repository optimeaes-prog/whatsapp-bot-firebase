# Per-Org Template Cutover Runbook

## Objective
Cut over to strict per-org WhatsApp template ownership with intentional downtime and fail-closed enforcement.

## Freeze Window
- Freeze all business-initiated outbound template sends.
- Announce maintenance window to internal operators.

## Deployment Order
1. Deploy functions with fail-closed runtime enforcement.
2. Verify `callHandoffReadiness` returns `eligible` and `missingRequiredKeys`.
3. Run backfill endpoint to mark unready orgs blocked.

## Backfill Command (HTTP)
- Endpoint: `POST /backfillPerOrgTemplateEligibility`
- Body (all orgs): `{}`
- Body (single org): `{ "orgId": "<ORG_ID>" }`

Expected write target:
- `organizations/{orgId}/botConfig/config.templateEligibility`
  - `outboundTemplatesBlocked`
  - `missingRequiredKeys`
  - `checkedAt`

## Readiness Validation Checklist
- Intake org has `twilioTemplates.voiceOptInConsent`.
- Target org has language-specific handoff templates for active provider.
- Target org has language-specific initial templates for new lead flows.
- Agent notification fallback template exists for active provider.
- `callHandoffReadiness` and actual send behavior match (no false green).

## Twilio Transport Migration
- Goal: move Twilio account transport from project-level params to org-level config.
- Target Firestore path:
  - `organizations/{orgId}/botConfig/config.twilioConfig`
- Required fields:
  - `accountSid`
  - `whatsappNumber`
  - `smsSenderId`
  - `authTokenSecretName`
- Secret handling:
  - Create per-org Secret Manager secret for auth token (e.g. `twilio_org_<orgId>_auth_token`).
  - Store only secret name in Firestore.
- Endpoint available:
  - `POST /migrateTwilioTransportToOrg` (super admin, defaults to `org_paco_granados`).

## Re-enable Strategy
- Re-enable orgs incrementally (ready orgs first).
- For each org:
  1. Fix missing keys.
  2. Re-run `callHandoffReadiness`.
  3. Re-run backfill for that org.
  4. Confirm `outboundTemplatesBlocked=false`.

## Rollback
- Roll back by deployment version only.
- Do not reintroduce global template sharing logic.
- Keep blocked orgs blocked until validated.
