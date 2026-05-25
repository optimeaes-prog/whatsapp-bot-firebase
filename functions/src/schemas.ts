import { z } from "zod";

// Tight chatId pattern: phone-style identifiers plus common WhatsApp suffixes
// (@c.us, @s.whatsapp.net) and Twilio-format prefixes. Capped at 64 chars.
const CHAT_ID_REGEX = /^[A-Za-z0-9_+@.:-]+$/;

export const SendMessageSchema = z.object({
  chatId: z.string().min(1).max(64).regex(CHAT_ID_REGEX),
  text: z.string().min(1).max(4000),
});

export const SendMassMessageSchema = z.object({
  chatIds: z.array(z.string().min(1).max(64).regex(CHAT_ID_REGEX)).min(1).max(500),
  text: z.string().min(1).max(4000),
});

// Intake from Idealista (or relay). Phone format is loose to allow international
// digits with leading + / spaces; downstream code normalizes.
export const NewLeadSchema = z.object({
  telefono: z.string().min(5).max(32),
  anuncio: z.string().min(1).max(128),
  orgId: z.string().min(1).max(128),
  nombre: z.string().max(128).optional(),
  language: z.enum(["es", "en", ""]).optional(),
});
