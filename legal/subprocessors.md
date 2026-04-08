# Sub-processors / Subencargados — Talmate (indicative list)

**Last updated:** 2026-04-01  
**Version:** 0.1 (draft)  

This is an indicative list to support the DPA. The definitive list should match your production configuration.

## Core infrastructure
- **Google / Firebase**
  - **Service**: Hosting, Authentication, Firestore database, Cloud Functions/Tasks, logging/monitoring.
  - **Data**: Account data, platform data, and (when acting as Processor) customer content such as conversations/leads as stored/processed in Firestore/Functions.
  - **Notes**: Location depends on project configuration and vendor operations. Transfers may occur.

## Messaging / communications
- **Twilio**
  - **Service**: WhatsApp messaging (where used) and Voice webhooks/calls.
  - **Data**: phone numbers, message metadata/content, call metadata, and recordings where enabled.

- **Whapi**
  - **Service**: WhatsApp gateway API.
  - **Data**: phone numbers, chat identifiers, message content/metadata.

## AI
- **OpenAI**
  - **Service**: AI-generated replies and lead summarisation.
  - **Data**: conversation history and lead attributes included in prompts; output text/JSON summaries.
  - **Notes**: Code uses `store: false` in API requests, but this does not remove the need for DPA sub-processor and transfer coverage.

## Payments
- **Stripe**
  - **Service**: Checkout, subscriptions, billing, payment processing.
  - **Data**: billing identifiers, payment status, subscription metadata.

## Scheduling / onboarding
- **Calendly**
  - **Service**: scheduling and webhook events for onboarding.
  - **Data**: invitee and event information (as configured).

## Optional / if enabled
- **Vapi**
  - **Service**: voice/call automation tooling.
  - **Data**: call metadata and/or transcripts/recordings depending on configuration.

## Analytics / advertising (to be confirmed)
- **[ANALYTICS_VENDOR]**
- **[ADS_VENDOR_1]**
- **[ADS_VENDOR_2]**

