import { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { getAppUrl } from "../lib/env";
import { canAccessBusiness } from "../middleware/requireAuth";

const log = logger.child({ module: "rss" });

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc2822(date: string): string {
  return new Date(date).toUTCString();
}

/**
 * GET /api/rss/:workflowId  (public)
 * Valid RSS 2.0 feed for the given workflow.
 */
export async function handleGetRssFeed(req: Request, res: Response) {
  const { workflowId } = req.params;

  try {
    const db = getSupabaseClient();
    const { data: items, error } = await db
      .from("rss_feed_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("pub_date", { ascending: false })
      .limit(50);

    if (error) {
      log.error({ err: error }, "RSS feed query failed");
      return res.status(500).send("Error fetching feed items");
    }

    const feedTitle = items?.[0]?.feed_title || "Completed Jobs Feed";
    const feedDescription = "Automated feed of completed jobs";
    const feedLink = `${getAppUrl()}/api/rss/${encodeURIComponent(workflowId)}`;
    const lastBuildDate = items?.[0]?.pub_date ? toRfc2822(items[0].pub_date) : new Date().toUTCString();

    const itemsXml = (items || [])
      .map(
        (item) => `
    <item>
      <title>${escapeXml(item.item_title || "")}</title>
      <description>${escapeXml(item.item_description || "")}</description>
      <link>${escapeXml(item.item_link || feedLink)}</link>
      <guid isPermaLink="false">${escapeXml(item.item_guid || item.id)}</guid>
      <pubDate>${toRfc2822(item.pub_date || item.created_at)}</pubDate>
    </item>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(xml);
  } catch (err) {
    log.error({ err }, "RSS feed error");
    res.status(500).send("Internal server error");
  }
}

/**
 * POST /api/rss/:workflowId/items  (auth)
 * Body: { item_title, item_description?, item_link?, feed_title? }
 * (`sub_account_id` is taken from the caller's profile, not the body.)
 * The caller must own the workflow's business (or the workflowId must be the
 * caller's own account id for legacy per-account feeds).
 */
export async function handleAddRssItem(req: Request, res: Response) {
  const { workflowId } = req.params;
  const { item_title, item_description, item_link, feed_title } = req.body ?? {};

  if (!item_title || typeof item_title !== "string") {
    return res.status(400).json({ error: "item_title is required" });
  }

  try {
    const db = getSupabaseClient();

    // Authorise: workflowId is either a workflow owned by the caller, or the
    // caller's own legacy account id.
    let allowed = req.profile?.accountId === workflowId;
    if (!allowed) {
      const { data: wf } = await db.from("workflows").select("business_id").eq("id", workflowId).maybeSingle();
      allowed = !!wf && canAccessBusiness(req, wf.business_id as string);
    }
    if (!allowed) return res.status(404).json({ error: "Feed not found" });

    const { data, error } = await db
      .from("rss_feed_items")
      .insert({
        workflow_id: workflowId,
        // Always the caller's own account; a body-supplied sub_account_id is ignored.
        sub_account_id: req.profile?.accountId || null,
        feed_title: feed_title || "Completed Jobs Feed",
        item_title: item_title.slice(0, 500),
        item_description: typeof item_description === "string" ? item_description.slice(0, 10_000) : "",
        item_link: typeof item_link === "string" ? item_link.slice(0, 2000) : null,
      })
      .select()
      .single();

    if (error) {
      log.error({ err: error }, "RSS insert error");
      return res.status(500).json({ error: "Failed to add RSS item" });
    }

    res.json({ success: true, item: data });
  } catch (err) {
    log.error({ err }, "RSS add item error");
    res.status(500).json({ error: "Internal server error" });
  }
}
