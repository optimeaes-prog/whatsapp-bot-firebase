# Scripts

This directory contains utility scripts for managing the Firebase database.

## Available Scripts

### `add:listings`
```bash
npm run add:listings
```

Adds listings to the Firestore database. This script uses Firebase Admin SDK to batch write listing documents to the `listings` collection in the `realestate-whatsapp-bot` database.

**Requirements:**
- Firebase Admin SDK credentials (automatically configured with project ID)
- The script reads from `functions/.env` for service account credentials (optional)
- If no service account is found, it uses default credentials with the project ID

**Usage:**
Edit the `addListingsAdmin.mjs` file to add or modify the listings array, then run:
```bash
npm run add:listings
```

### `add:qualified-leads`
```bash
npm run add:qualified-leads
```

Adds qualified leads to the Firestore database and updates the corresponding leads with qualification status. This script:
- Adds entries to the `qualifiedLeads` collection
- Updates matching leads in the `leads` collection with `qualificationStatus: 'qualified'`
- Maps qualified leads with their corresponding leads by phone and listingCode

**Requirements:**
- Firebase Admin SDK credentials (automatically configured with project ID)
- Uses the same credential system as `add:listings`
- No additional setup needed if you can run `add:listings`

**Usage:**
Edit the `addQualifiedLeads.mjs` file to add or modify the qualified leads array, then run:
```bash
npm run add:qualified-leads
```

## How to Add New Listings

1. Open `scripts/addListingsAdmin.mjs`
2. Add or modify entries in the `listings` array
3. Run `npm run add:listings`
4. The script will batch-add all listings to Firestore with automatic timestamps

## How to Add Qualified Leads

1. Open `scripts/addQualifiedLeads.mjs`
2. Add or modify entries in the `qualifiedLeadsData` array
3. Run `npm run add:qualified-leads`
4. The script will:
   - Add qualified leads to the `qualifiedLeads` collection
   - Update matching leads with qualification status
   - Skip duplicates if already exist

## Listing Data Structure

Each listing should have the following fields:
- `description` (string): Short name/description of the listing
- `listingCode` (string): Unique code/ID for the listing
- `link` (string): URL to the listing on Idealista or other platform
- `operationType` (string): Either "Venta" or "Alquiler"
- `features` (string): Comma-separated list of features/characteristics
- `profitabilityReportAvailable` (boolean): Whether a profitability report exists
- `profitabilityReport` (string): The full profitability report text (if available)

## Qualified Lead Data Structure

Each qualified lead should have the following fields:
- `phone` (string): Phone number of the lead
- `chatId` (string): WhatsApp chat ID
- `listingCode` (string): Code of the listing they're interested in
- `conversationSummary` (string): Detailed summary of the conversation
- `name` (string): Name of the lead (can be empty)
- `qualified` (boolean): Always true for qualified leads
