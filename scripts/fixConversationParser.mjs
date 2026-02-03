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

// IMPROVED parser that handles multi-line messages correctly
function parseConversation(conversationText) {
  const history = [];
  let timestamp = Date.now();
  
  // Split by [BOT] and [CLIENTE] markers
  const parts = conversationText.split(/(\[BOT\]|\[CLIENTE\])/);
  
  let currentRole = null;
  let currentText = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    
    if (part === '[BOT]') {
      // Save previous message if exists
      if (currentRole && currentText.trim()) {
        history.push({
          role: currentRole,
          text: currentText.trim(),
          timestamp: timestamp
        });
        timestamp += 1000;
      }
      currentRole = 'assistant';
      currentText = '';
    } else if (part === '[CLIENTE]') {
      // Save previous message if exists
      if (currentRole && currentText.trim()) {
        history.push({
          role: currentRole,
          text: currentText.trim(),
          timestamp: timestamp
        });
        timestamp += 1000;
      }
      currentRole = 'user';
      currentText = '';
    } else if (part && currentRole) {
      // Accumulate text for current message
      currentText += (currentText ? '\n' : '') + part;
    }
  }
  
  // Don't forget the last message
  if (currentRole && currentText.trim()) {
    history.push({
      role: currentRole,
      text: currentText.trim(),
      timestamp: timestamp
    });
  }
  
  return history;
}

// Test the parser with the example conversation
const testConversation = `[BOT] Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.

No olvides seguirme, encontrarás todo tipo de oportunidades inmobiliarias en este perfil👇

https://www.instagram.com/pacogrosa.realestate?igsh=MTNxamt5OThoeHBrdQ%3D%3D&utm_source=qr
[BOT] Te has interesado en esta vivienda en alquiler👇

https://www.idealista.com/inmueble/110181098/?utm_medium=socialmedia&utm_campaign=private_sendadtofriend&utm_source=notifications

Por confirmar, ¿has visto las características?

• Alquiler de temporada hasta junio de 2026

* Si en algún momento digo algo que no procede, pido comprensión, cada día me están mejorando para dar el mejor servicio 🤩
[CLIENTE] Si
[BOT] Genial, gracias por confirmarlo.  
¿Con quién hablo?

Además, para avanzar necesito: ¿Cuántas personas viviréis? ¿Ingresos netos mensuales? ¿Fecha de entrada? ¿Mascotas?`;

console.log('Testing parser...\n');
const parsed = parseConversation(testConversation);
console.log(`Parsed ${parsed.length} messages:\n`);
parsed.forEach((msg, index) => {
  console.log(`[${index}] ${msg.role.toUpperCase()}:`);
  console.log(msg.text);
  console.log('---');
});

async function fixConversation() {
  const chatId = '34669354177@s.whatsapp.net';
  
  console.log('\n\nUpdating conversation in database...');
  
  const history = parseConversation(testConversation);
  
  await db.collection('conversations').doc(chatId).update({
    history: history,
    messageCount: history.length
  });
  
  console.log('✅ Conversation updated successfully!');
  console.log(`Updated message count: ${history.length}`);
  
  process.exit(0);
}

fixConversation().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
