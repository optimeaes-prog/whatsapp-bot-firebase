import { useState } from "react";
import { resolveListingCandidates, type BotTestCandidate } from "../services/botTest";

export function BotTest() {
  const [text, setText] = useState("");
  const [operationType, setOperationType] = useState<"" | "Venta" | "Alquiler">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"none" | "match" | "candidates" | null>(null);
  const [candidates, setCandidates] = useState<BotTestCandidate[]>([]);

  const runTest = async () => {
    setError(null);
    setKind(null);
    setCandidates([]);
    if (!text.trim()) {
      setError("Please enter buffered text first.");
      return;
    }
    setLoading(true);
    try {
      const result = await resolveListingCandidates({
        text: text.trim(),
        operationType: operationType || undefined,
      });
      setKind(result.kind);
      setCandidates(result.candidates || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">Bot Test</h1>
        <p className="mt-2 text-sm text-gray-600">
          Paste buffered text to see ranked listing candidates and confidence from the resolver.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Buffered text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="Example: Busco piso en Chamberi sobre 2.200€/mes, calle Fuencarral..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Operation type (optional)</label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value as "" | "Venta" | "Alquiler")}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Any</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
            </select>

            <button
              type="button"
              onClick={runTest}
              disabled={loading}
              className="mt-4 w-full rounded-btn bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {loading ? "Running..." : "Run Resolver"}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Output</h2>
        {error && (
          <div className="mt-4 rounded-btn border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {!error && kind === "none" && (
          <p className="mt-4 text-sm text-gray-600">No candidates were returned.</p>
        )}
        {!error && candidates.length > 0 && (
          <div className="mt-4 space-y-3">
            {candidates.map((candidate, index) => (
              <div key={`${candidate.listingCode}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      #{index + 1} Listing {candidate.listingCode}
                    </p>
                    {candidate.description && (
                      <p className="mt-1 text-sm text-gray-700">{candidate.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                      {candidate.orgId && <span>Org: {candidate.orgId}</span>}
                      {candidate.address && <span>Address: {candidate.address}</span>}
                      {candidate.price !== undefined && <span>Price: {candidate.price}</span>}
                    </div>
                    {candidate.link && (
                      <a
                        href={candidate.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs text-primary-700 underline"
                      >
                        Open listing
                      </a>
                    )}
                  </div>
                  <div className="rounded-btn bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">
                    {(candidate.confidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!error && kind === null && (
          <p className="mt-4 text-sm text-gray-500">Run a test to see resolver output.</p>
        )}
      </div>
    </div>
  );
}
