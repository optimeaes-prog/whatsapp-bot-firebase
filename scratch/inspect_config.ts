import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

async function run() {
  const db = admin.firestore().terminate().then(() => admin.firestore(admin.app(), 'realestate-whatsapp-bot'));
  // Wait, I can't use terminate like that.
}
