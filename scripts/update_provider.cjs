const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const dotenv = require("dotenv");
const { resolve } = require("path");

// Load environment variables from functions/.env
dotenv.config({ path: resolve(__dirname, "../functions/.env") });

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "real-estate-idealista-bot"
  });
}

const DATABASE_ID = "realestate-whatsapp-bot";
const db = getFirestore(admin.app(), DATABASE_ID);

async function checkConfig() {
  const configPath = "organizations/org_paco_granados/botConfig/config";
  const configDoc = await db.doc(configPath).get();

  if (!configDoc.exists) {
    console.log("Config document not found at", configPath);
    console.log("Creating default config with messagingProvider: 'twilio'...");
    await db.doc(configPath).set({
      activeStyleId: "directo",
      messagingProvider: "twilio",
      styles: [
        {
          id: "directo",
          name: "Directo y Eficiente",
          description: "Mensajes cortos, sin relleno, agrupa preguntas.",
          promptModifier: "- Mensajes CORTOS y DIRECTOS..."
        }
      ]
    });
    console.log("Created successfully!");
    return;
  }

  const data = configDoc.data();
  console.log("Current bot configuration:");
  console.log(JSON.stringify(data, null, 2));

  if (data?.messagingProvider !== "twilio") {
    console.log("\nSwitching messagingProvider to 'twilio'...");
    await db.doc(configPath).update({ messagingProvider: "twilio" });
    console.log("Updated successfully!");
  } else {
    console.log("\nmessagingProvider is already set to 'twilio'.");
  }
}

checkConfig().catch(console.error);
