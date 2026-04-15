
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore(admin.app(), "realestate-whatsapp-bot");

// Copied logic from the new endpoint but adapted for local script execution
async function runRetryManually() {
  const userEmail = "ejperezreyes@gmail.com";
  console.log(`Searching for organization of ${userEmail}...`);

  const userSnap = await db.collection("users").where("email", "==", userEmail).get();
  if (userSnap.empty) {
    console.error("User not found");
    return;
  }

  const orgId = userSnap.docs[0].data().orgId;
  if (!orgId) {
    console.error("Organization ID not found for user");
    return;
  }

  console.log(`Found OrgId: ${orgId}. Searching for stuck leads...`);

  const leadsRef = db.collection("organizations").doc(orgId).collection("leads");
  const leadsSnap = await leadsRef.get();
  
  const stuckLeads = [];
  for (const doc of leadsSnap.docs) {
    const lead = doc.data();
    if (!lead.chatId) continue;

    const convRef = db.collection("organizations").doc(orgId).collection("conversations").doc(lead.chatId);
    const convSnap = await convRef.get();
    
    if (convSnap.exists()) {
      const conv = convSnap.data();
      // Alicia, Maria, Loles should match this: flowStep idealista_confirm and no history
      if (conv.flowStep === "idealista_confirm" && (!conv.history || conv.history.length === 0)) {
        stuckLeads.push({ id: doc.id, ...lead });
      }
    }
  }

  console.log(`Found ${stuckLeads.length} leads to retry.`);

  // Since I can't call the Cloud Function logic easily with all its injected secrets (OpenAI, Twilio, etc.) 
  // from a simple node script without more setup, the best way for the USER to do this is to 
  // just call the endpoint I created using a temporary UI button or just wait for me to suggest 
  // how to trigger it.
  
  // Actually, I can't run the full pipeline here because I don't have the Secrets (OPENAI_API_KEY, etc.) 
  // exported to my shell.
  
  for (const lead of stuckLeads) {
    console.log(`- Detected: ${lead.name} (${lead.phone}) for listing ${lead.listingCode}`);
  }
}

runRetryManually();
