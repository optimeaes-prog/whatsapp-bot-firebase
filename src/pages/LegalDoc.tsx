import { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  path: string; // public path, e.g. /legal/terms.es.md
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdownVeryBasic(markdown: string): string {
  // Minimal, safe renderer for our legal docs:
  // - headings (#/##/###)
  // - bold **text**
  // - links [text](url)
  // - paragraphs and line breaks
  // Everything else is escaped.
  const escaped = escapeHtml(markdown);
  const lines = escaped.split("\n");

  const htmlLines = lines.map((line) => {
    const trimmed = line.trimEnd();
    if (!trimmed) return "";

    const h3 = trimmed.match(/^###\s+(.*)$/);
    if (h3) return `<h3>${h3[1]}</h3>`;

    const h2 = trimmed.match(/^##\s+(.*)$/);
    if (h2) return `<h2>${h2[1]}</h2>`;

    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1) return `<h1>${h1[1]}</h1>`;

    let out = trimmed;
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer">$1</a>`);

    return `<p>${out}</p>`;
  });

  return htmlLines.filter(Boolean).join("\n");
}

export function LegalDoc({ title, path }: Props) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    fetch(path, { credentials: "omit" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.text();
      })
      .then((text) => {
        if (!mounted) return;
        setContent(text);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [path]);

  const html = useMemo(() => renderMarkdownVeryBasic(content), [content]);

  return (
    <div className="min-h-[60vh] max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-heading">{title}</h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 font-heading">Documento legal</p>
      </div>

      {loading && <div className="text-gray-600">Cargando…</div>}

      {!loading && error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg">
          No se pudo cargar el documento: {error}
        </div>
      )}

      {!loading && !error && (
        <div
          className="prose prose-sm sm:prose max-w-none prose-a:text-primary-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

