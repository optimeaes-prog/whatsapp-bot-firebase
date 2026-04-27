# Functions Runtime Inventory

Date: 2026-04-23

## Scope

- Entrypoint: `functions/src/index.ts`
- Auxiliary files checked for legacy runtime usage:
  - `functions/src/services/authTriggers.ts`
  - `functions/src/calendlyWebhook.ts`

## Summary

- Active exported functions from `functions/src/index.ts`: 59
- Active 1st gen exports in entrypoint: 0
- Active 2nd gen exports in entrypoint: 59
- Legacy 1st gen declarations found outside entrypoint: 0
- Orphaned (not exported through entrypoint) function declarations found: 1
  - `calendlyWebhook` in `functions/src/calendlyWebhook.ts` (v2 HTTPS trigger)

## Classification

- `onRequest` exports (v2 HTTPS): 50
- `onSchedule` exports (v2 Scheduler): 5
- `onDocumentWritten` exports (v2 Firestore): 4

## Notes

- The currently deployed code path should be fully v2 from the entrypoint perspective.
- Runtime migration completed: no `firebase-functions/v1` usage remains in `functions/src`.
