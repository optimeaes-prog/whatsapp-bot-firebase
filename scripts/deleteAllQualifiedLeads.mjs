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

async function deleteAllQualifiedLeads() {
  console.log('🔍 Fetching all qualified leads...');
  
  try {
    const qualifiedLeadsSnapshot = await db.collection('qualifiedLeads').get();
    const totalQualifiedLeads = qualifiedLeadsSnapshot.size;
    
    if (totalQualifiedLeads === 0) {
      console.log('✅ No qualified leads found in the database.');
      return;
    }
    
    console.log(`📊 Found ${totalQualifiedLeads} qualified leads to delete.`);
    console.log('🗑️  Starting deletion process...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete qualified leads in batches
    const batchSize = 500;
    const batches = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    
    qualifiedLeadsSnapshot.docs.forEach((doc) => {
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
        const batchDeleteCount = Math.min(batchSize, totalQualifiedLeads - (i * batchSize));
        deletedCount += batchDeleteCount;
        console.log(`✓ Deleted batch ${i + 1}/${batches.length} (${batchDeleteCount} qualified leads)`);
      } catch (error) {
        errorCount += Math.min(batchSize, totalQualifiedLeads - (i * batchSize));
        console.error(`✗ Error deleting batch ${i + 1}:`, error.message);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total qualified leads found: ${totalQualifiedLeads}`);
    console.log(`Successfully deleted: ${deletedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (deletedCount === totalQualifiedLeads) {
      console.log('\n✅ All qualified leads have been deleted successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error fetching qualified leads:', error);
    throw error;
  }
}

// Run the script
deleteAllQualifiedLeads()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
