import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import type { ListingRow } from "../types";
import {
  resolveRecipientsFromListing,
  resolveQualifiedLeadNotificationRecipientsWithMode,
} from "../services/qualifiedLeadNotificationTargets";

/**
 * Minimal Firestore stub: just enough surface area for the resolver to walk
 *   db.collection("organizations").doc(orgId).collection("notificationNumbers").doc(id).get()
 *   db.collection("users").doc(uid).get()
 *
 * Each "doc" is keyed by its full path so callers can plant fixtures
 * declaratively.
 */
type Fixture = Record<string, unknown> | undefined;

function fakeDb(fixtures: Record<string, Fixture>): Firestore {
  function docHandle(path: string) {
    return {
      path,
      get: async () => {
        const data = fixtures[path];
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
    };
  }
  function collectionHandle(path: string): {
    doc: (id: string) => ReturnType<typeof docHandle>;
  } {
    return {
      doc: (id: string) => {
        const childPath = `${path}/${id}`;
        const handle = docHandle(childPath) as ReturnType<typeof docHandle> & {
          collection: (sub: string) => ReturnType<typeof collectionHandle>;
        };
        handle.collection = (sub: string) => collectionHandle(`${childPath}/${sub}`);
        return handle;
      },
    };
  }
  return {
    collection: (path: string) => collectionHandle(path),
  } as unknown as Firestore;
}

const ORG = "org_test";

test("resolveRecipientsFromListing returns null when listing has no ids", async () => {
  const out = await resolveRecipientsFromListing({
    db: fakeDb({}),
    orgId: ORG,
    listing: { notificationNumberIds: undefined } as unknown as ListingRow,
  });
  assert.equal(out, null);
});

test("resolveRecipientsFromListing returns null when listing is null", async () => {
  const out = await resolveRecipientsFromListing({
    db: fakeDb({}),
    orgId: ORG,
    listing: null,
  });
  assert.equal(out, null);
});

test("resolveRecipientsFromListing returns verified e164s in input order", async () => {
  const db = fakeDb({
    [`organizations/${ORG}/notificationNumbers/id_a`]: { e164: "+34611111111", verified: true },
    [`organizations/${ORG}/notificationNumbers/id_b`]: { e164: "+34622222222", verified: true },
  });
  const out = await resolveRecipientsFromListing({
    db,
    orgId: ORG,
    listing: { notificationNumberIds: ["id_b", "id_a"] } as ListingRow,
  });
  assert.deepEqual(out, ["+34622222222", "+34611111111"]);
});

test("resolveRecipientsFromListing skips docs that are not verified", async () => {
  const db = fakeDb({
    [`organizations/${ORG}/notificationNumbers/id_a`]: { e164: "+34611111111", verified: true },
    [`organizations/${ORG}/notificationNumbers/id_b`]: { e164: "+34622222222", verified: false },
  });
  const out = await resolveRecipientsFromListing({
    db,
    orgId: ORG,
    listing: { notificationNumberIds: ["id_a", "id_b"] } as ListingRow,
  });
  assert.deepEqual(out, ["+34611111111"]);
});

test("resolveRecipientsFromListing skips docs that don't exist", async () => {
  const db = fakeDb({
    [`organizations/${ORG}/notificationNumbers/id_a`]: { e164: "+34611111111", verified: true },
  });
  const out = await resolveRecipientsFromListing({
    db,
    orgId: ORG,
    listing: { notificationNumberIds: ["id_a", "id_missing"] } as ListingRow,
  });
  assert.deepEqual(out, ["+34611111111"]);
});

test("resolveQualifiedLeadNotificationRecipientsWithMode: listing path wins when ids resolve", async () => {
  const db = fakeDb({
    [`organizations/${ORG}/notificationNumbers/id_a`]: { e164: "+34611111111", verified: true },
  });
  const result = await resolveQualifiedLeadNotificationRecipientsWithMode({
    orgId: ORG,
    db,
    botConfig: { notificationNumbers: "+34655555555" },
    envNotificationFallback: "",
    listing: { notificationNumberIds: ["id_a"], assignedAgentUid: "uid_x" } as ListingRow,
  });
  assert.equal(result.mode, "listing");
  assert.deepEqual(result.recipients, ["+34611111111"]);
});

test("resolveQualifiedLeadNotificationRecipientsWithMode: falls back to legacy when listing has no ids", async () => {
  const db = fakeDb({});
  const result = await resolveQualifiedLeadNotificationRecipientsWithMode({
    orgId: ORG,
    db,
    botConfig: { notificationNumbers: "+34611111111" },
    envNotificationFallback: "",
    listing: { listingCode: "L1" } as ListingRow,
  });
  assert.equal(result.mode, "legacy_fallback");
  assert.deepEqual(result.recipients, ["+34611111111"]);
});

test("resolveQualifiedLeadNotificationRecipientsWithMode: falls back when ids reference unverified-only", async () => {
  const db = fakeDb({
    [`organizations/${ORG}/notificationNumbers/id_a`]: { e164: "+34611111111", verified: false },
  });
  const result = await resolveQualifiedLeadNotificationRecipientsWithMode({
    orgId: ORG,
    db,
    botConfig: { notificationNumbers: "+34699999999" },
    envNotificationFallback: "",
    listing: { notificationNumberIds: ["id_a"], listingCode: "L1" } as ListingRow,
  });
  assert.equal(result.mode, "legacy_fallback");
  assert.deepEqual(result.recipients, ["+34699999999"]);
});

test("resolveQualifiedLeadNotificationRecipientsWithMode: empty mode when no listing and no legacy nums", async () => {
  const db = fakeDb({});
  const result = await resolveQualifiedLeadNotificationRecipientsWithMode({
    orgId: ORG,
    db,
    botConfig: { notificationNumbers: undefined },
    envNotificationFallback: "",
    listing: null,
  });
  assert.equal(result.mode, "empty");
  assert.deepEqual(result.recipients, []);
});
