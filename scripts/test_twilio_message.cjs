const axios = require("axios");
const dotenv = require("dotenv");
const { resolve } = require("path");

// Load environment variables from functions/.env
dotenv.config({ path: resolve(__dirname, "../functions/.env") });

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
} = process.env;

async function sendTestMessage(to, body) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.error("Missing Twilio configuration in functions/.env");
    process.exit(1);
  }

  const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:+${to.replace(/^\+/, "")}`;
  const fromWhatsApp = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:") ? TWILIO_WHATSAPP_NUMBER : `whatsapp:+${TWILIO_WHATSAPP_NUMBER.replace(/^\+/, "")}`;

  console.log(`Sending message from ${fromWhatsApp} to ${toWhatsApp}...`);

  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      new URLSearchParams({
        From: fromWhatsApp,
        To: toWhatsApp,
        Body: body,
      }).toString(),
      {
        auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    console.log("Success! Message SID:", response.data.sid);
  } catch (error) {
    console.error("Failed to send message:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Get recipient from command line argument
const recipient = process.argv[2];
const body = process.argv[3] || "Hola! Este es un mensaje de prueba desde el bot de Twilio.";

if (!recipient) {
  console.log("Usage: node scripts/test_twilio_message.cjs <phone_number> [message_body]");
  process.exit(1);
}

sendTestMessage(recipient, body);
