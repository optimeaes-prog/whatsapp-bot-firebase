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
  } catch (e) {}
}

// Initialize Firebase Admin
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  admin.initializeApp({
    projectId: 'real-estate-idealista-bot'
  });
}

// Get Firestore instance with the specific database
const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

async function finalCheck() {
  console.log('=== FINAL ALIGNMENT CHECK ===\n');
  
  const conversationsSnapshot = await db.collection('conversations').get();
  const leadsSnapshot = await db.collection('leads').get();
  
  const conversations = new Map();
  const leads = new Map();
  
  conversationsSnapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.phone}_${data.listingCode}`;
    conversations.set(key, { id: doc.id, ...data });
  });
  
  leadsSnapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.phone}_${data.listingCode}`;
    leads.set(key, { id: doc.id, ...data });
  });
  
  console.log(`Total conversations: ${conversations.size}`);
  console.log(`Total leads: ${leads.size}`);
  
  let conversationsWithoutLeads = 0;
  let leadsWithoutConversations = 0;
  let aligned = 0;
  
  for (const [key, conv] of conversations) {
    if (!leads.has(key)) {
      conversationsWithoutLeads++;
      console.log(`\n⚠️  Conversation without lead:`);
      console.log(`   Phone: ${conv.phone}`);
      console.log(`   Listing: ${conv.listingCode}`);
      console.log(`   Name: ${conv.name}`);
    } else {
      aligned++;
    }
  }
  
  for (const [key, lead] of leads) {
    if (!conversations.has(key)) {
      leadsWithoutConversations++;
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✓ Conversations with matching leads: ${aligned}`);
  console.log(`✓ Leads without conversations: ${leadsWithoutConversations} (normal for leads without messages yet)`);
  console.log(`${conversationsWithoutLeads === 0 ? '✓' : '⚠️'} Conversations without leads: ${conversationsWithoutLeads}`);
  console.log(`\n${conversationsWithoutLeads === 0 ? '✅ All conversations have corresponding leads!' : '⚠️  Some conversations are missing leads'}`);
}

// Run the script
finalCheck()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
