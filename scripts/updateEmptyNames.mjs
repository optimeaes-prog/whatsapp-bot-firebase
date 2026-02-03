import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse the .env file
const envPath = path.join(__dirname, '../functions/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

// Parse environment variables
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex);
      const value = trimmed.substring(equalIndex + 1);
      env[key] = value;
    }
  }
}

// Check for service account in env
let serviceAccount;
if (env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    console.log('✅ Using service account from FIREBASE_SERVICE_ACCOUNT env variable');
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
  }
}

// Initialize Firebase Admin
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.log('⚠️  No service account found, using default credentials with explicit project');
  admin.initializeApp({
    projectId: 'real-estate-idealista-bot'
  });
}

// Get Firestore instance with the specific database
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

async function updateEmptyNames() {
  console.log('Starting to update empty names...\n');
  
  let conversationsUpdated = 0;
  let leadsUpdated = 0;
  
  // Update conversations
  console.log('Updating conversations...');
  const conversationsSnapshot = await db.collection('conversations').get();
  
  for (const doc of conversationsSnapshot.docs) {
    const data = doc.data();
    const name = data.name || '';
    
    // Check if name is empty, null, undefined, "null", or "el colaborador"
    if (!name || 
        name === '' || 
        name === 'null' || 
        name === 'el colaborador' ||
        name.toLowerCase() === 'el colaborador') {
      await doc.ref.update({ name: '–' });
      conversationsUpdated++;
      console.log(`  ✓ Updated conversation: ${doc.id} (was: "${name}")`);
    }
  }
  
  // Update leads
  console.log('\nUpdating leads...');
  const leadsSnapshot = await db.collection('leads').get();
  
  for (const doc of leadsSnapshot.docs) {
    const data = doc.data();
    const name = data.name || '';
    
    // Check if name is empty, null, undefined, "null", or "el colaborador"
    if (!name || 
        name === '' || 
        name === 'null' || 
        name === 'el colaborador' ||
        name.toLowerCase() === 'el colaborador') {
      await doc.ref.update({ name: '–' });
      leadsUpdated++;
      console.log(`  ✓ Updated lead: ${doc.id} (was: "${name}")`);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Conversations updated: ${conversationsUpdated}`);
  console.log(`Leads updated: ${leadsUpdated}`);
  console.log(`Total updated: ${conversationsUpdated + leadsUpdated}`);
}

// Run the script
updateEmptyNames()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
