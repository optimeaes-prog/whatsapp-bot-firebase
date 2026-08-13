/**
 * Chooses which lead row a conversation belongs to.
 *
 * A conversation is keyed by phone alone, but lead rows have historically been
 * keyed by phone + listing code, so one chat can end up pointing at more than one
 * lead row. Every write used to take `docs[0]` — whichever document id sorted
 * first — so the name, the qualification and the consent stamp could each land on
 * a different row, or on the row for a property the chat isn't even about.
 *
 * The rule below is deliberate and stable: given the same rows it always returns
 * the same one, and the row it returns only ever gains data, so it cannot
 * flip-flop between two rows as the conversation progresses.
 */

/** The only fields the rule looks at. Anything lead-shaped satisfies this. */
export interface LeadCandidate {
  id: string;
  listingCode?: string;
  name?: string;
  consent?: unknown;
  qualificationStatus?: string;
  conversationSummary?: string;
  /** Firestore Timestamp, millis, or absent on legacy rows. */
  createdAt?: { toMillis?: () => number } | number | null;
}

function createdAtMillis(candidate: LeadCandidate): number {
  const raw = candidate.createdAt;
  if (typeof raw === "number") return raw;
  if (raw && typeof raw.toMillis === "function") return raw.toMillis();
  // Legacy rows without createdAt sort last, so a dated row always wins.
  return Number.MAX_SAFE_INTEGER;
}

/**
 * How much conversation-derived data a row already carries. The chosen row keeps
 * receiving the writes, so its score only grows — that is what makes the choice
 * stable over the life of a conversation.
 */
function completenessScore(candidate: LeadCandidate): number {
  let score = 0;
  if (candidate.name) score += 1;
  if (candidate.consent) score += 1;
  if (candidate.qualificationStatus === "qualified" || candidate.qualificationStatus === "rejected") score += 1;
  if (candidate.conversationSummary) score += 1;
  return score;
}

/**
 * Pick the lead row that owns this conversation.
 *
 * Order of preference:
 *   1. the row for the property the conversation is currently about,
 *   2. the row carrying the most information about the lead,
 *   3. the oldest row (the original one),
 *   4. document id, so the result never depends on query order.
 */
export function pickLeadCandidate<T extends LeadCandidate>(
  candidates: T[],
  preferredListingCode?: string
): T | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const wanted = (preferredListingCode || "").trim();
  const matching = wanted && wanted !== "__pending__"
    ? candidates.filter((c) => (c.listingCode || "").trim() === wanted)
    : [];
  const pool = matching.length > 0 ? matching : candidates;

  return [...pool].sort((a, b) => {
    const byCompleteness = completenessScore(b) - completenessScore(a);
    if (byCompleteness !== 0) return byCompleteness;
    const byAge = createdAtMillis(a) - createdAtMillis(b);
    if (byAge !== 0) return byAge;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}
