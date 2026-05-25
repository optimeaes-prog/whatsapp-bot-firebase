const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'real-estate-idealista-bot' });
const db = admin.firestore();
db.settings({ databaseId: 'realestate-whatsapp-bot' });

(async () => {
  const chatId = '34669354177@s.whatsapp.net';
  const orgs = ['u7knHl2U48I7NnateEZE', 'org_paco_granados'];
  for (const orgId of orgs) {
    const ref = db.doc(`organizations/${orgId}/conversations/${chatId}`);
    const snap = await ref.get();
    console.log(`\n=== Org ${orgId} ===`);
    if (!snap.exists) { console.log('  NOT FOUND'); continue; }
    const d = snap.data();
    console.log('  has history field:', 'history' in d);
    console.log('  history type:', Array.isArray(d.history) ? `array(${d.history.length})` : typeof d.history);
    console.log('  language:', d.language);
    console.log('  listingCode:', d.listingCode);
    console.log('  handoff:', JSON.stringify(d.handoff));
    console.log('  flowStep:', d.flowStep);
    console.log('  isFinished:', d.isFinished);
    console.log('  tags:', d.tags);
    console.log('  phone:', d.phone);
  }
  process.exit(0);
})();
