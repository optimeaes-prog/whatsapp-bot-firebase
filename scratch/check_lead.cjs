
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'real-estate-idealista-bot'
  });
}

const db = admin.firestore();
db.settings({ databaseId: 'realestate-whatsapp-bot' });

async function checkLead(chatId) {
  console.log(`Checking lead: ${chatId}`);
  const doc = await db.collection('organizations/org_paco_granados/conversations').doc(chatId).get();
  if (doc.exists) {
    console.log('Conversation Data:', JSON.stringify(doc.data(), null, 2));
  } else {
    console.log('Conversation not found');
  }
}

const chatId = process.argv[2] || '34662959865@s.whatsapp.net';
checkLead(chatId).catch(console.error);
