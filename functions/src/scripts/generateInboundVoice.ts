import fs from "node:fs";
import path from "node:path";

import { generateSpeechMp3 } from "../services/elevenLabsClient";

/**
 * One-off script: (re)generate the three INBOUND voice locuciones with the approved
 * ElevenLabs voice so the whole inbound phone call uses a single, consistent voice.
 *
 * The voiceId MUST match OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT in src/index.ts.
 *
 * Files are written to <repoRoot>/public/voice/ ; Vite copies public/ into dist/ on the
 * frontend build, and Firebase Hosting serves them under /voice/** with `Cache-Control: no-store`,
 * so overwriting in place is safe (no cache busting / filename versioning needed).
 *
 * Run:
 *   cd functions
 *   ELEVENLABS_KEY=<your-key> npm run generate:inbound-voice
 *   # or: npm run generate:inbound-voice -- --key=<your-key>
 */

// Approved ElevenLabs voice — keep in sync with OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT.
const VOICE_ID = "7QQzpAyzlKTVrRzQJmTE";

// Exact current scripts (wording unchanged — only the voice changes).
const LOCUCIONES: Array<{ file: string; text: string }> = [
  {
    // #1 — greeting (asks the caller's name, then a 3s pause in TwiML)
    file: "message_part_1.mp3",
    text: "Hola, gracias por llamar a nuestra agencia inmobiliaria, soy su asistente virtual. ¿Me puede decir su nombre por favor?",
  },
  {
    // #2 — opt-in prompt played inside the DTMF gather
    file: "message_part_2_optin.mp3",
    text: "Muchas gracias. Para ofrecerte un mejor servicio, actualmente agendamos visitas y resolvemos tus dudas por WhatsApp. Si quieres que te contactemos de inmediato, por favor pulse 1.",
  },
  {
    // #3 — confirmation after the caller presses 1 (replaces the old Twilio Polly <Say>)
    file: "message_part_3.mp3",
    text: "Gracias. En breve recibirá un mensaje por WhatsApp.",
  },
];

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

async function main(): Promise<void> {
  const apiKey = (getArg("key") || process.env.ELEVENLABS_KEY || process.env["11LABS_KEY"] || "").trim();
  if (!apiKey) {
    throw new Error('Missing ElevenLabs API key. Provide "--key=<key>" or set ELEVENLABS_KEY.');
  }

  // Compiled location: functions/lib/scripts/generateInboundVoice.js → repo root is three levels up.
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const outDir = path.join(repoRoot, "public", "voice");
  fs.mkdirSync(outDir, { recursive: true });

  for (const loc of LOCUCIONES) {
    process.stdout.write(`Generating ${loc.file} (voiceId ${VOICE_ID}) … `);
    const mp3 = await generateSpeechMp3({ apiKey, voiceId: VOICE_ID, text: loc.text });
    const dest = path.join(outDir, loc.file);
    fs.writeFileSync(dest, mp3);
    console.log(`done — ${mp3.length} bytes → ${dest}`);
  }

  console.log("\nAll three inbound locuciones generated with the approved ElevenLabs voice.");
  console.log("Next: build the frontend and deploy hosting + the voiceGatherCallback function.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
