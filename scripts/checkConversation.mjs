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

async function checkConversation() {
  const chatId = '34669354177@s.whatsapp.net';
  
  const doc = await db.collection('conversations').doc(chatId).get();
  
  if (doc.exists) {
    const data = doc.data();
    console.log('Conversation data for', chatId);
    console.log('Number of history items:', data.history?.length);
    console.log('\nHistory:');
    data.history?.forEach((item, index) => {
      console.log(`\n[${index}] ${item.role}:`);
      console.log(item.text);
    });
  } else {
    console.log('Conversation not found');
  }
  
  process.exit(0);
}

checkConversation().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
