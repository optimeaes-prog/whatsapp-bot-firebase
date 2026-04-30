import axios from "axios";

type TwilioContentResource = {
  sid: string;
  friendly_name: string;
  language: string;
  variables?: Record<string, string>;
  types: Record<string, unknown>;
};

type TwilioListContentResponse = {
  meta?: {
    next_page_url?: string | null;
    key?: string;
  };
  contents?: TwilioContentResource[];
};

function requireEnv(name: string): string {
  const v = String(process.env[name] || "").trim();
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  pageSize: number;
  onlyNamePrefix?: string;
} {
  const dryRun = argv.includes("--dry-run");
  const pageSizeRaw = argv.find((a) => a.startsWith("--page-size="))?.split("=", 2)[1];
  const onlyNamePrefix = argv.find((a) => a.startsWith("--only-name-prefix="))?.split("=", 2)[1];
  const pageSize = pageSizeRaw ? Number(pageSizeRaw) : 50;
  if (!Number.isFinite(pageSize) || pageSize <= 0 || pageSize > 1000) {
    throw new Error("--page-size must be a number between 1 and 1000");
  }
  return { dryRun, pageSize, onlyNamePrefix };
}

function contentKey(c: Pick<TwilioContentResource, "friendly_name" | "language">): string {
  return `${String(c.friendly_name || "").trim().toLowerCase()}::${String(c.language || "").trim().toLowerCase()}`;
}

async function listAllContent(params: {
  accountSid: string;
  authToken: string;
  pageSize: number;
}): Promise<TwilioContentResource[]> {
  const out: TwilioContentResource[] = [];
  let nextUrl: string | null = `https://content.twilio.com/v1/Content?PageSize=${encodeURIComponent(String(params.pageSize))}&Page=0`;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      auth: { username: params.accountSid, password: params.authToken },
      headers: { "Content-Type": "application/json" },
    });
    const data = (response.data || {}) as TwilioListContentResponse;
    const contents = Array.isArray(data.contents) ? data.contents : [];
    for (const c of contents) {
      if (!c?.sid || !c?.friendly_name || !c?.language || !c?.types) continue;
      out.push(c);
    }
    nextUrl = typeof data.meta?.next_page_url === "string" && data.meta.next_page_url.trim()
      ? data.meta.next_page_url.trim()
      : null;
  }

  return out;
}

async function createContent(params: {
  accountSid: string;
  authToken: string;
  friendlyName: string;
  language: string;
  variables?: Record<string, string>;
  types: Record<string, unknown>;
}): Promise<{ sid: string }> {
  const response = await axios.post(
    "https://content.twilio.com/v1/Content",
    {
      friendly_name: params.friendlyName,
      language: params.language,
      variables: params.variables,
      types: params.types,
    },
    {
      auth: { username: params.accountSid, password: params.authToken },
      headers: { "Content-Type": "application/json" },
    }
  );
  const sid = String(response.data?.sid || "").trim();
  if (!sid) throw new Error("Twilio Content create did not return sid");
  return { sid };
}

async function main(): Promise<void> {
  const { dryRun, pageSize, onlyNamePrefix } = parseArgs(process.argv.slice(2));

  const srcAccountSid = requireEnv("TWILIO_SRC_ACCOUNT_SID");
  const srcAuthToken = requireEnv("TWILIO_SRC_AUTH_TOKEN");
  const dstAccountSid = requireEnv("TWILIO_DST_ACCOUNT_SID");
  const dstAuthToken = requireEnv("TWILIO_DST_AUTH_TOKEN");

  if (srcAccountSid === dstAccountSid) {
    throw new Error("Source and destination Account SIDs are the same; refusing to run.");
  }

  console.log(`[twilio-content] Listing source templates (pageSize=${pageSize})...`);
  const src = await listAllContent({ accountSid: srcAccountSid, authToken: srcAuthToken, pageSize });
  const srcFiltered = onlyNamePrefix
    ? src.filter((c) => String(c.friendly_name || "").startsWith(onlyNamePrefix))
    : src;

  console.log(`[twilio-content] Listing destination templates (pageSize=${pageSize})...`);
  const dst = await listAllContent({ accountSid: dstAccountSid, authToken: dstAuthToken, pageSize });
  const dstKeys = new Set(dst.map(contentKey));

  console.log(
    `[twilio-content] Source: ${src.length} templates (${srcFiltered.length} after filter). Destination: ${dst.length} templates.`
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of srcFiltered) {
    const key = contentKey(c);
    if (dstKeys.has(key)) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] create ${c.friendly_name} (${c.language})`);
      created++;
      dstKeys.add(key);
      continue;
    }

    try {
      const res = await createContent({
        accountSid: dstAccountSid,
        authToken: dstAuthToken,
        friendlyName: c.friendly_name,
        language: c.language,
        variables: c.variables,
        types: c.types,
      });
      created++;
      dstKeys.add(key);
      console.log(`[created] ${c.friendly_name} (${c.language}) -> ${res.sid}`);
    } catch (err) {
      failed++;
      console.warn(`[failed] ${c.friendly_name} (${c.language})`, err);
    }
  }

  console.log(`[twilio-content] Done. created=${created}, skipped=${skipped}, failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

