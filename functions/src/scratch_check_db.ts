import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: "https://real-estate-idealista-bot.firebaseio.com"
  });
}

const db = admin.firestore();

async function check() {
  const email = "ejperezreyes@gmail.com";
  console.log("Checking user:", email);

  const usersSnap = await db.collection("users").where("email", "==", email).get();
  if (usersSnap.empty) {
    console.log("User not found by email");
    return;
  }
  
  const userDoc = usersSnap.docs[0];
  const userData = userDoc.data();
  const uid = userDoc.id;
  console.log("User UID:", uid);
  console.log("User Data:", JSON.stringify(userData, null, 2));
  
  const orgId = userData.orgId;
  if (orgId) {
    console.log("Checking botConfig for org:", orgId);
    const configRef = db.collection("organizations").doc(orgId).collection("botConfig").doc("config");
    const configSnap = await configRef.get();
    if (configSnap.exists) {
      console.log("Config exists:", JSON.stringify(configSnap.data(), null, 2));
    } else {
      console.log("Config does NOT exist at organizations/" + orgId + "/botConfig/config");
    }
  }
}

check().catch(console.error);
