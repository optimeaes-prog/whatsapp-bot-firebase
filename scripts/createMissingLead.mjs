import admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
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

async function createMissingLead() {
  console.log('Creating missing lead for conversation 34669354177...\n');
  
  const phone = "34669354177";
  const chatId = "34669354177@s.whatsapp.net";
  const listingCode = "110181098";
  
  // Check if lead already exists
  const existingLeadSnapshot = await db
    .collection('leads')
    .where('phone', '==', phone)
    .where('listingCode', '==', listingCode)
    .get();
  
  if (!existingLeadSnapshot.empty) {
    console.log('Lead already exists, skipping...');
    return;
  }
  
  // Get conversation to extract details
  const conversationSnapshot = await db
    .collection('conversations')
    .doc(chatId)
    .get();
  
  if (!conversationSnapshot.exists) {
    console.log('Conversation not found!');
    return;
  }
  
  const conversationData = conversationSnapshot.data();
  
  // Determine operation type based on listing code
  const listingSnapshot = await db
    .collection('listings')
    .where('listingCode', '==', listingCode)
    .get();
  
  let operationType = 'Alquiler'; // Default
  if (!listingSnapshot.empty) {
    operationType = listingSnapshot.docs[0].data().operationType;
  }
  
  // Create the lead
  const leadData = {
    phone: phone,
    chatId: chatId,
    listingCode: listingCode,
    operationType: operationType,
    createdAt: Timestamp.now(),
    name: conversationData.name || '–',
    firstMessageDate: conversationData.lastMessage,
    lastMessageDate: conversationData.lastMessage,
    qualificationStatus: 'not_qualified'
  };
  
  await db.collection('leads').add(leadData);
  
  console.log('✓ Created lead successfully');
  console.log('  Phone:', phone);
  console.log('  Listing:', listingCode);
  console.log('  Operation:', operationType);
  console.log('  Name:', leadData.name);
}

// Run the script
createMissingLead()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
