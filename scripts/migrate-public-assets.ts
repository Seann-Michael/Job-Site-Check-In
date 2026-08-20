/**
 * One-off: move public-by-design objects from the (now private) `media`
 * bucket to the public `public-assets` bucket.
 *
 * Prefixes moved (same object key in the new bucket):
 *   business-logos/      review-gate-videos/      branding/
 *
 * This includes the legacy `review-gate-videos/1773717533399-bzaego7uvwv.MP4`
 * object that has no owner segment (service role bypasses storage RLS, so
 * the path check does not apply here).
 *
 * Companion to supabase/migrations/20260820006000_private_media_bucket.sql,
 * which already rewrote the persisted URLs to point at `public-assets`.
 * Run this right after applying that migration:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-public-assets.ts
 *   # add --dry-run to only print what would move
 *
 * Idempotent: objects that already exist in `public-assets` are skipped
 * (and removed from `media` so a re-run converges).
 */
import { createClient } from "@supabase/supabase-js";

const SRC = "media";
const DST = "public-assets";
const PREFIXES = ["business-logos", "review-gate-videos", "branding"];
const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** Recursively list every object key under `prefix` in `bucket`. */
async function listAll(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders come back with a null id; files carry metadata/id.
      if (entry.id === null || entry.id === undefined) {
        out.push(...(await listAll(bucket, full)));
      } else {
        out.push(full);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function existsInDst(objectKey: string): Promise<boolean> {
  const slash = objectKey.lastIndexOf("/");
  const dir = slash === -1 ? "" : objectKey.slice(0, slash);
  const name = slash === -1 ? objectKey : objectKey.slice(slash + 1);
  const { data } = await db.storage.from(DST).list(dir, { search: name, limit: 100 });
  return !!data?.some((e) => e.name === name);
}

async function main() {
  let moved = 0;
  let skipped = 0;
  let failed = 0;
  for (const prefix of PREFIXES) {
    const keys = await listAll(SRC, prefix);
    console.log(`${prefix}/: ${keys.length} object(s)`);
    for (const objectKey of keys) {
      try {
        if (await existsInDst(objectKey)) {
          console.log(`  skip (already in ${DST}): ${objectKey}`);
          if (!DRY_RUN) await db.storage.from(SRC).remove([objectKey]);
          skipped++;
          continue;
        }
        if (DRY_RUN) {
          console.log(`  would move: ${objectKey}`);
          moved++;
          continue;
        }
        // Cross-bucket move is supported by supabase-js >= 2.39 via the
        // destinationBucket option.
        const { error } = await db.storage.from(SRC).move(objectKey, objectKey, { destinationBucket: DST });
        if (error) throw error;
        console.log(`  moved: ${objectKey}`);
        moved++;
      } catch (err) {
        failed++;
        console.error(`  FAILED ${objectKey}:`, err instanceof Error ? err.message : err);
      }
    }
  }
  console.log(`\nDone. moved=${moved} skipped=${skipped} failed=${failed}${DRY_RUN ? " (dry run)" : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
