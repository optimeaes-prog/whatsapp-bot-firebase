import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Status = {
  code: string;
  status: string;
  requestedAt?: { seconds: number } | null;
  note?: string;
};

export function DeletionStatus() {
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Falta el parámetro 'code' en la URL.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "dataDeletionRequests", code));
        if (!snap.exists()) {
          setError("No se ha encontrado ninguna solicitud con ese código.");
        } else {
          setStatus(snap.data() as Status);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Estado de la solicitud de borrado</h1>
        <p className="text-sm text-gray-600 mb-6">
          Proplead · Meta Data Deletion Request
        </p>
        {loading && <p className="text-gray-600">Cargando…</p>}
        {error && <p className="text-red-700">{error}</p>}
        {status && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-gray-800">Código de confirmación</dt>
              <dd className="font-mono text-gray-900">{status.code}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-800">Estado</dt>
              <dd className="text-gray-900 capitalize">{status.status}</dd>
            </div>
            {status.requestedAt && (
              <div>
                <dt className="font-semibold text-gray-800">Fecha de solicitud</dt>
                <dd className="text-gray-900">
                  {new Date(status.requestedAt.seconds * 1000).toLocaleString("es-ES")}
                </dd>
              </div>
            )}
            {status.note && (
              <div>
                <dt className="font-semibold text-gray-800">Nota</dt>
                <dd className="text-gray-700">{status.note}</dd>
              </div>
            )}
          </dl>
        )}
        <p className="mt-8 text-xs text-gray-500">
          Para cualquier duda escribe a <a href="mailto:dpo@proplead.io" className="underline">dpo@proplead.io</a>.
        </p>
      </div>
    </div>
  );
}
