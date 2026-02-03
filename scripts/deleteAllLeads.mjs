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

async function deleteAllLeads() {
  console.log('🔍 Fetching all leads...');
  
  try {
    const leadsSnapshot = await db.collection('leads').get();
    const totalLeads = leadsSnapshot.size;
    
    if (totalLeads === 0) {
      console.log('✅ No leads found in the database.');
      return;
    }
    
    console.log(`📊 Found ${totalLeads} leads to delete.`);
    console.log('🗑️  Starting deletion process...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete leads in batches
    const batchSize = 500;
    const batches = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    
    leadsSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref);
      operationCount++;
      
      if (operationCount === batchSize) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    });
    
    // Add the last batch if it has operations
    if (operationCount > 0) {
      batches.push(currentBatch);
    }
    
    // Commit all batches
    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        const batchDeleteCount = Math.min(batchSize, totalLeads - (i * batchSize));
        deletedCount += batchDeleteCount;
        console.log(`✓ Deleted batch ${i + 1}/${batches.length} (${batchDeleteCount} leads)`);
      } catch (error) {
        errorCount += Math.min(batchSize, totalLeads - (i * batchSize));
        console.error(`✗ Error deleting batch ${i + 1}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total leads found: ${totalLeads}`);
    console.log(`Successfully deleted: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (deletedCount === totalLeads) {
      console.log('\n✅ All leads have been deleted successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error fetching leads:', error);
    throw error;
  }
}

// Run the script
deleteAllLeads()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
