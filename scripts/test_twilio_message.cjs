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

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(a);
    }
  }
  return parsed;
}

async function sendTestMessage({ to, body, contentSid, contentVars }) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    console.error("Missing Twilio configuration in functions/.env");
    process.exit(1);
  }

  const toWhatsApp = to.startsWith("whatsapp:") ? to : `whatsapp:+${to.replace(/^\+/, "")}`;
  const fromWhatsApp = TWILIO_WHATSAPP_NUMBER.startsWith("whatsapp:") ? TWILIO_WHATSAPP_NUMBER : `whatsapp:+${TWILIO_WHATSAPP_NUMBER.replace(/^\+/, "")}`;

  const mode = contentSid ? `template ${contentSid}` : "freeform body";
  console.log(`Sending ${mode} from ${fromWhatsApp} to ${toWhatsApp}...`);

  try {
    const payload = new URLSearchParams({
      From: fromWhatsApp,
      To: toWhatsApp,
    });

    if (contentSid) {
      payload.set("ContentSid", contentSid);
      if (contentVars) payload.set("ContentVariables", contentVars);
    } else {
      payload.set("Body", body);
    }

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      payload.toString(),
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

const args = parseArgs(process.argv);

// Positional args: <phone_number> [message_body]
const recipient = args._[0];
const body = args._[1] || "Hola! Este es un mensaje de prueba desde el bot de Twilio.";
const contentSid = args.contentSid || args.templateSid || args.contentsid || args.templatesid;
const contentVars = args.contentVars || args.templateVars || args.contentvariables || args.templatevariables;

if (!recipient) {
  console.log("Usage:");
  console.log("  node scripts/test_twilio_message.cjs <phone_number> [message_body]");
  console.log("  node scripts/test_twilio_message.cjs <phone_number> --contentSid <HX...> [--contentVars '{\"1\":\"foo\"}']");
  process.exit(1);
}

sendTestMessage({ to: recipient, body, contentSid, contentVars });
