import { Fragment } from "react";

// Render a chat-message body that may contain WhatsApp-style bold markers
// (`**bold**` or `*bold*`). We split on those markers and emit React nodes —
// never `dangerouslySetInnerHTML` — so inbound text that contains HTML or
// `<script>` payloads is rendered as literal characters, not parsed as DOM.
//
// Previously this lived inline in Conversations.tsx / Leads.tsx as
//   `__html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')…`
// which let any prospective lead inject XSS by sending a WhatsApp message
// containing e.g. `<img src=x onerror="…">`.
export function renderMessageText(text: string) {
  if (!text) return null;
  // Match `**…**` or `*…*`. The `?` keeps each run non-greedy so adjacent
  // markers don't merge. We keep the markers in the split output (via the
  // capture group) so we can re-detect and wrap them.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
