import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

const REGION = "europe-west1";

export const calendlyWebhook = onRequest(
  { cors: true, region: REGION, secrets: ["SMTP_PASS"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const calendlySignature = req.headers["calendly-webhook-signature"] as string;
      if (!calendlySignature) {
        res.status(400).json({ error: "Missing signature" });
        return;
      }

      // Format of the signature: t=<timestamp>,v1=<signature>
      const parts = calendlySignature.split(",");
      const tPart = parts.find((part) => part.startsWith("t="));
      const v1Part = parts.find((part) => part.startsWith("v1="));

      if (!tPart || !v1Part) {
        res.status(400).json({ error: "Invalid signature format" });
        return;
      }

      const t = tPart.split("=")[1];
      const v1 = v1Part.split("=")[1];

      // Recreate the signature to verify
      const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY || "";
      if (!webhookSigningKey) {
        console.error("CALENDLY_WEBHOOK_SIGNING_KEY not set in environment");
        res.status(500).json({ error: "Missing webhook signing key in environment" });
        return;
      }

      const payload = t + "." + JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSigningKey)
        .update(payload, "utf8")
        .digest("hex");

      if (expectedSignature !== v1) {
        // Prevent replay attacks (optional checking of timestamp could be added here)
        console.error("Invalid webhook signature");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      // Signature is valid, process event
      const event = req.body.event;
      if (event === "invitee.created") {
        console.log("Calendly invitee.created received, updating organization...");
        
        const payloadObj = req.body.payload;
        const rescheduleUrl = payloadObj.reschedule_url;
        const eventUri = payloadObj.event; // URI for the scheduled event
        
        let startTime = "";
        
        // Fetch event details to get the start_time
        const pat = process.env.CALENDLY_CLIENT_SECRET || process.env.CALENDLY_CLIENT_ID || ""; // Since user might have put PAT in one of these
        // Ideally we fetch from the API, but let's do a quick fetch
        if (eventUri) {
          try {
            const https = await import("https");
            const eventDetails: any = await new Promise((resolve, reject) => {
              const urlParts = new URL(eventUri);
              const options = {
                hostname: urlParts.hostname,
                path: urlParts.pathname + urlParts.search,
                method: "GET",
                headers: pat ? { Authorization: `Bearer ${pat}` } : {}
              };
              
              const req = https.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => { resolve(JSON.parse(data)); });
              });
              req.on("error", reject);
              req.end();
            });
            
            if (eventDetails?.resource?.start_time) {
              startTime = eventDetails.resource.start_time;
            }
          } catch (e) {
            console.error("Failed to fetch event details for start_time", e);
          }
        }

        // Usamos la misma lógica hardcodeada que en el frontend para org_paco_granados
        const orgId = "org_paco_granados";
        const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
        const docRef = db.collection("organizations").doc(orgId);

        const updates: any = { onboardingCallScheduled: true };
        if (startTime) updates.onboardingCallDate = startTime;
        if (rescheduleUrl) updates.onboardingRescheduleUrl = rescheduleUrl;

        await docRef.set(updates, { merge: true });
        console.log("Successfully marked onboardingCallScheduled with details", updates);
      } else if (event === "invitee.canceled") {
         // Si se cancela la cita, reabrimos el banner
         const orgId = "org_paco_granados";
         const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
         const docRef = db.collection("organizations").doc(orgId);
         await docRef.set({ 
           onboardingCallScheduled: false, 
           onboardingCallDate: null, 
           onboardingRescheduleUrl: null 
         }, { merge: true });
         console.log("Successfully reverted onboardingCallScheduled=false due to cancellation");
      } else {
        console.log(`Received unhandled calendly event: ${event}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error processing calendly webhook", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
