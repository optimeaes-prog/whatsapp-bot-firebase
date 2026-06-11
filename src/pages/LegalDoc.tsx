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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

type TocEntry = { id: string; text: string; level: 2 | 3 };

function renderMarkdownVeryBasic(markdown: string): { html: string; toc: TocEntry[] } {
  // Minimal, safe renderer for our legal docs:
  // - headings (#/##/###)
  // - bold **text**
  // - links [text](url)
  // - paragraphs and line breaks
  // Everything else is escaped.
  const escaped = escapeHtml(markdown);
  const lines = escaped.split("\n");
  const toc: TocEntry[] = [];
  const seen = new Set<string>();
  const uniqueId = (base: string): string => {
    let id = base || "section";
    let n = 1;
    while (seen.has(id)) {
      id = `${base}-${n++}`;
    }
    seen.add(id);
    return id;
  };

  const htmlLines = lines.map((line) => {
    const trimmed = line.trimEnd();
    if (!trimmed) return "";

    const h3 = trimmed.match(/^###\s+(.*)$/);
    if (h3) {
      const id = uniqueId(slugify(h3[1]));
      toc.push({ id, text: h3[1], level: 3 });
      return `<h3 id="${id}">${h3[1]}</h3>`;
    }

    const h2 = trimmed.match(/^##\s+(.*)$/);
    if (h2) {
      const id = uniqueId(slugify(h2[1]));
      toc.push({ id, text: h2[1], level: 2 });
      return `<h2 id="${id}">${h2[1]}</h2>`;
    }

    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1) return `<h1>${h1[1]}</h1>`;

    let out = trimmed;
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noreferrer">$1</a>`);

    return `<p>${out}</p>`;
  });

  return { html: htmlLines.filter(Boolean).join("\n"), toc };
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

  const { html, toc } = useMemo(() => renderMarkdownVeryBasic(content), [content]);

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

      {!loading && !error && toc.length > 2 && (
        <details className="mb-6 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-700 font-heading uppercase tracking-wider hover:bg-gray-100 transition-colors">
            Índice de contenido ({toc.length})
          </summary>
          <nav className="px-4 pb-3 pt-1">
            <ol className="space-y-1.5 list-none p-0 m-0">
              {toc.map((entry) => (
                <li key={entry.id} className={entry.level === 3 ? "pl-4" : ""}>
                  <a
                    href={`#${entry.id}`}
                    className="block text-sm text-gray-700 hover:text-primary-700 hover:underline py-1"
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>
      )}

      {!loading && !error && (
        <>
          <div
            className="prose prose-sm sm:prose max-w-none prose-a:text-primary-700 scroll-mt-20"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {toc.length > 2 && (
            <div className="mt-12 mb-4 text-center">
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-primary-700 px-3 py-2 rounded-btn border border-gray-200 hover:border-primary-200 transition-colors font-heading uppercase tracking-wider"
              >
                ↑ Volver arriba
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

