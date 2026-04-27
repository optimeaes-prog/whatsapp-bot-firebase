import axios from "axios";

type GenerateSpeechParams = {
  apiKey: string;
  voiceId: string;
  text: string;
};

/**
 * Generate MP3 audio from text using ElevenLabs TTS API.
 */
export async function generateSpeechMp3(params: GenerateSpeechParams): Promise<Buffer> {
  const apiKey = String(params.apiKey || "").trim();
  const voiceId = String(params.voiceId || "").trim();
  const text = String(params.text || "").trim();
  if (!apiKey) throw new Error("ElevenLabs API key is required");
  if (!voiceId) throw new Error("ElevenLabs voiceId is required");
  if (!text) throw new Error("ElevenLabs text is required");

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      model_id: "eleven_multilingual_v2",
      text,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    }
  );

  return Buffer.from(response.data as ArrayBuffer);
}
