export function buildTwiml(xmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xmlBody}\n</Response>`;
}

export function twimlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
