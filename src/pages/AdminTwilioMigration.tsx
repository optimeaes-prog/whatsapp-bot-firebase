import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, RefreshCw, Rocket, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getAllOrganizationsForSuperAdmin } from "../services/organization";
import {
  forceCompleteTwilioMigrationJob,
  listTwilioMigrationJobs,
  pollTwilioMigrationJob,
  retryTwilioMigrationStep,
  startTwilioSenderMigration,
  submitTwilioMigrationTemplates,
  subscribeTwilioMigrationJob,
  type TwilioMigrationJob,
  type TwilioMigrationJobSummary,
  type TwilioMigrationTemplateState,
} from "../services/twilioMigration";
import { Button, PageContainer, PageHeader } from "../components/ui";

const STATUS_STYLES: Record<string, string> = {
  approved: "text-green-700 bg-green-50",
  rejected: "text-red-700 bg-red-50",
  pending: "text-primary-700 bg-primary-50",
  received: "text-slate-700 bg-slate-100",
  paused: "text-gray-600 bg-gray-100",
  disabled: "text-gray-600 bg-gray-100",
  not_submitted: "text-gray-500 bg-gray-50",
};

function StatusBadge({ status }: { status: string }) {
  const klass = STATUS_STYLES[status] || "text-gray-700 bg-gray-100";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${klass}`}>{status}</span>
  );
}

function formatRelativeTime(value: unknown): string {
  const ms = (() => {
    if (!value) return undefined;
    const maybe = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof maybe.toMillis === "function") return maybe.toMillis();
    if (typeof maybe.seconds === "number") return maybe.seconds * 1000;
    if (typeof maybe._seconds === "number") return maybe._seconds * 1000;
    return undefined;
  })();
  if (!ms) return "—";
  const delta = Date.now() - ms;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function AdminTwilioMigration() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";

  const [orgs, setOrgs] = useState<Array<{ id: string; agencyName?: string }>>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [targetOrgId, setTargetOrgId] = useState("");
  const [sourceOrgId, setSourceOrgId] = useState("");
  const [newAccountSid, setNewAccountSid] = useState("");
  const [newAuthToken, setNewAuthToken] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TwilioMigrationJob | null>(null);
  const [history, setHistory] = useState<TwilioMigrationJobSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  /**
   * Which template friendly_names the admin has checked for submission. Lazily
   * initialized to "all" the first time the job's templates land on the page.
   */
  const [selectedFriendlyNames, setSelectedFriendlyNames] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getAllOrganizationsForSuperAdmin();
        if (!cancelled) setOrgs(list);
      } catch (error) {
        toast.error(`Could not load orgs: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Load migration history (in-flight + recent completed) on mount and after a
  // job is started/submitted so the user always sees the latest state. Toggling
  // showCompleted re-fetches with a different filter.
  const refreshHistory = useCallback(async () => {
    if (!isAdmin) return;
    setHistoryLoading(true);
    try {
      const list = await listTwilioMigrationJobs({
        inFlightOnly: !showCompleted,
        max: showCompleted ? 50 : 25,
      });
      setHistory(list);
    } catch (error) {
      toast.error(
        `Could not load migration history: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [isAdmin, showCompleted]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (!jobId) return;
    const unsub = subscribeTwilioMigrationJob(jobId, (j) => {
      setJob(j);
      // First time the job's snapshot arrives, pre-check every template.
      if (j && selectedFriendlyNames === null) {
        const all = new Set(Object.values(j.templates || {}).map((t) => t.friendlyName));
        setSelectedFriendlyNames(all);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const canStart = useMemo(() => {
    return (
      !!targetOrgId &&
      !!sourceOrgId &&
      newAccountSid.trim().startsWith("AC") &&
      newAuthToken.trim().length >= 16 &&
      !starting
    );
  }, [targetOrgId, sourceOrgId, newAccountSid, newAuthToken, starting]);

  const sameOrg = !!targetOrgId && targetOrgId === sourceOrgId;

  async function handleStart() {
    if (!canStart) return;
    setStarting(true);
    try {
      const result = await startTwilioSenderMigration({
        targetOrgId,
        sourceOrgId,
        newAccountSid: newAccountSid.trim(),
        newAuthToken: newAuthToken.trim(),
      });
      setJobId(result.jobId);
      setSelectedFriendlyNames(null); // re-init from the new job's snapshot
      toast.success(
        `Migration ${result.resumed ? "resumed" : "prepared"}. ` +
          `Sender: ${result.newWhatsappNumber}. ` +
          `${result.totalTemplates} source templates snapshotted. ` +
          "Select which to submit for approval and click Submit selected."
      );
      setNewAuthToken("");
      refreshHistory();
    } catch (error) {
      toast.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmitSelected() {
    if (!jobId || !selectedFriendlyNames) return;
    if (selectedFriendlyNames.size === 0) {
      toast.error("Select at least one template before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitTwilioMigrationTemplates({
        jobId,
        friendlyNames: Array.from(selectedFriendlyNames),
      });
      toast.success(
        `Submitted ${result.submitted} template(s) for WhatsApp approval. ` +
          `${result.skipped} skipped.`
      );
      refreshHistory();
    } catch (error) {
      toast.error(`Submission failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelected(friendlyName: string) {
    setSelectedFriendlyNames((prev) => {
      const next = new Set(prev || []);
      if (next.has(friendlyName)) next.delete(friendlyName);
      else next.add(friendlyName);
      return next;
    });
  }

  function setAllSelected(allOn: boolean) {
    if (!job) return;
    if (allOn) {
      setSelectedFriendlyNames(
        new Set(Object.values(job.templates || {}).map((t) => t.friendlyName))
      );
    } else {
      setSelectedFriendlyNames(new Set());
    }
  }

  async function handleRefresh() {
    if (!jobId) return;
    setPolling(true);
    try {
      const r = await pollTwilioMigrationJob(jobId);
      toast.success(`Refreshed (${r.updated} updated${r.complete ? ", complete" : ""})`);
    } catch (error) {
      toast.error(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPolling(false);
    }
  }

  async function handleForceComplete() {
    if (!jobId) return;
    const ok = window.confirm(
      "Mark this migration job as complete? This only updates the job's state — it won't write any HX SIDs into botConfig that aren't already there. Use this when you've finished the migration manually outside the system."
    );
    if (!ok) return;
    try {
      await forceCompleteTwilioMigrationJob(jobId);
      toast.success("Migration job marked complete.");
      refreshHistory();
    } catch (error) {
      toast.error(`Force complete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleRetry(step: string) {
    if (!jobId) return;
    try {
      await retryTwilioMigrationStep(jobId, step);
      toast.success(`Retried ${step}`);
    } catch (error) {
      toast.error(`Retry failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isAdmin) {
    return (
      <PageContainer>
        <PageHeader title="Twilio sender migration" />
        <div className="p-4 text-sm text-gray-600">Restricted to admins.</div>
      </PageContainer>
    );
  }

  const templates: Array<[string, TwilioMigrationTemplateState]> = job
    ? Object.entries(job.templates || {})
    : [];
  const approvedCount = templates.filter(([, t]) => t.approvalStatus === "approved").length;

  return (
    <PageContainer>
      <PageHeader title="Twilio sender migration" subtitle="Configure a new Twilio account end-to-end for an org" />

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Target org</label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              disabled={orgsLoading || starting}
            >
              <option value="">Select…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.agencyName ? `${o.agencyName} (${o.id})` : o.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source org (templates)</label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              value={sourceOrgId}
              onChange={(e) => setSourceOrgId(e.target.value)}
              disabled={orgsLoading || starting}
            >
              <option value="">Select…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.agencyName ? `${o.agencyName} (${o.id})` : o.id}
                  {o.id === targetOrgId ? " — same as target" : ""}
                </option>
              ))}
            </select>
            {sameOrg && (
              <div className="mt-1 text-xs text-amber-700">
                Source = Target: cloning {targetOrgId}'s current Twilio templates into the new account
                and then repointing {targetOrgId}'s slots to the new SIDs. Existing slot values
                will be overwritten.
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Twilio Account SID</label>
            <input
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
              placeholder="AC…"
              value={newAccountSid}
              onChange={(e) => setNewAccountSid(e.target.value)}
              disabled={starting}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Twilio Auth Token</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
              placeholder="paste the auth token"
              value={newAuthToken}
              onChange={(e) => setNewAuthToken(e.target.value)}
              disabled={starting}
            />
          </div>
        </div>
        <div className="text-xs text-gray-500">
          The new account must have exactly one online WhatsApp sender. All cloned templates will be
          submitted for WhatsApp approval as <span className="font-mono">MARKETING</span>.
        </div>
        <div className="flex justify-end">
          <Button onClick={handleStart} disabled={!canStart}>
            {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
            Prepare migration
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Step 1 — Prepare migration: verifies credentials, configures the sender webhook, writes
          target botConfig and snapshots the source account's templates. <strong>No templates are
          submitted for WhatsApp approval at this stage.</strong> You'll review and choose which
          ones to submit in Step 2.
        </div>
      </div>

      {/* Migration history (in-flight by default; toggle to include completed). */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm font-semibold">Migration history</div>
            <div className="text-xs text-gray-500">
              {showCompleted
                ? "Showing recent migrations (in-flight + completed/failed)."
                : "Showing in-flight migrations only. Click any row to view live state and resume."}
            </div>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              Include completed
            </label>
            <Button variant="ghost" onClick={refreshHistory} disabled={historyLoading}>
              {historyLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Reload
            </Button>
          </div>
        </div>

        {historyLoading && history.length === 0 ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-gray-500">
            {showCompleted ? "No migrations yet." : "No in-flight migrations."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Job</th>
                  <th className="text-left px-3 py-2 font-medium">Target → Source</th>
                  <th className="text-left px-3 py-2 font-medium">New sender</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Templates</th>
                  <th className="text-left px-3 py-2 font-medium">Created</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const tmpls = Object.values(h.templates || {});
                  const approved = tmpls.filter((t) => t.approvalStatus === "approved").length;
                  const total = tmpls.length;
                  const isSelected = jobId === h.id;
                  return (
                    <tr
                      key={h.id}
                      className={`border-t border-gray-100 ${isSelected ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{h.id}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className="font-mono">{h.targetOrgId}</span>
                        {" ← "}
                        <span className="font-mono">{h.sourceOrgId}</span>
                        {h.targetOrgId === h.sourceOrgId && (
                          <span className="ml-1 text-amber-700">(same org)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{h.newWhatsappNumber || "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={h.status} />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {approved} / {total} approved
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {formatRelativeTime(h.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant={isSelected ? "secondary" : "primary"}
                          onClick={() => {
                            setJobId(h.id);
                            setSelectedFriendlyNames(null);
                          }}
                        >
                          {isSelected ? "Viewing" : "View / resume"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {job && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="space-y-0.5">
              <div className="text-sm text-gray-500">
                Job <span className="font-mono">{jobId}</span> · target{" "}
                <span className="font-mono">{job.targetOrgId}</span> · source{" "}
                <span className="font-mono">{job.sourceOrgId}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Status:</span>
                <StatusBadge status={job.status} />
                <span className="text-gray-500">
                  {approvedCount} / {templates.length} approved
                </span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500">Sender: {job.newWhatsappNumber}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500">
                  Webhook:{" "}
                  {job.webhookConfigured ? (
                    <CheckCircle className="inline w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <AlertCircle className="inline w-3.5 h-3.5 text-amber-500" />
                  )}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {!job.webhookConfigured && (
                <Button variant="secondary" onClick={() => handleRetry("webhook")}>
                  Retry webhook
                </Button>
              )}
              <Button variant="secondary" onClick={handleRefresh} disabled={polling}>
                {polling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh now
              </Button>
              {job.status !== "complete" && job.status !== "failed" && (
                <Button variant="ghost" onClick={handleForceComplete}>
                  Mark complete (force)
                </Button>
              )}
            </div>
          </div>

          {(() => {
            const inSelectionPhase = job.status === "templates_snapshotted";
            const selectedCount = selectedFriendlyNames?.size || 0;
            return (
              <>
                {inSelectionPhase && (
                  <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded px-3 py-2 text-sm">
                    <div>
                      <strong>Step 2 — Select templates to submit.</strong> Check the templates
                      you want to submit for WhatsApp approval as MARKETING. Unchecked templates
                      stay in the snapshot but won't be created in the new account.{" "}
                      <span className="text-gray-600">
                        ({selectedCount} of {templates.length} selected)
                      </span>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <Button variant="ghost" onClick={() => setAllSelected(true)}>
                        Select all
                      </Button>
                      <Button variant="ghost" onClick={() => setAllSelected(false)}>
                        Select none
                      </Button>
                      <Button
                        onClick={handleSubmitSelected}
                        disabled={submitting || selectedCount === 0}
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Rocket className="w-4 h-4 mr-2" />
                        )}
                        Submit selected ({selectedCount})
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {inSelectionPhase && (
                          <th className="text-left px-3 py-2 font-medium w-8">
                            <input
                              type="checkbox"
                              checked={
                                templates.length > 0 && selectedCount === templates.length
                              }
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate =
                                    selectedCount > 0 && selectedCount < templates.length;
                                }
                              }}
                              onChange={(e) => setAllSelected(e.target.checked)}
                            />
                          </th>
                        )}
                        <th className="text-left px-3 py-2 font-medium">Template</th>
                        <th className="text-left px-3 py-2 font-medium">Slot</th>
                        <th className="text-left px-3 py-2 font-medium">Lang</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">New SID</th>
                        <th className="text-left px-3 py-2 font-medium">Updated</th>
                        <th className="text-right px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(([key, t]) => {
                        const isChecked = selectedFriendlyNames?.has(t.friendlyName) ?? false;
                        return (
                          <tr key={key} className="border-t border-gray-100">
                            {inSelectionPhase && (
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelected(t.friendlyName)}
                                />
                              </td>
                            )}
                            <td className="px-3 py-2 font-mono text-xs">{t.friendlyName}</td>
                            <td className="px-3 py-2 text-xs">{t.mappedSlot || "—"}</td>
                            <td className="px-3 py-2 text-xs">{t.language}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={t.approvalStatus} />
                              {t.approvalStatus === "rejected" && t.approvalRejectionReason && (
                                <div className="text-xs text-red-600 mt-1">
                                  {t.approvalRejectionReason}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{t.newSid || "—"}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {formatRelativeTime(t.lastPolledAt)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {t.approvalStatus === "rejected" && (
                                <Button
                                  variant="secondary"
                                  onClick={() => handleRetry(`submit:${t.friendlyName}`)}
                                >
                                  Resubmit
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          {job.errors && job.errors.length > 0 && (
            <details className="text-xs text-red-700">
              <summary className="cursor-pointer">{job.errors.length} error(s) logged</summary>
              <ul className="mt-2 space-y-1">
                {job.errors.slice(-10).map((e, i) => (
                  <li key={i} className="font-mono">
                    <span className="text-gray-500">[{formatRelativeTime(e.at)}]</span> {e.step}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </PageContainer>
  );
}
