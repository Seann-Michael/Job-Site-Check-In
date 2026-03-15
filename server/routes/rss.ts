import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/** Escape XML special characters */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format a date as RFC 2822 for RSS */
function toRfc2822(date: string): string {
  return new Date(date).toUTCString();
}

/**
 * GET /api/rss/:workflowId
 * Returns a valid RSS 2.0 feed for the given workflow.
 * WordPress and any RSS reader can subscribe to this URL.
 */
export async function handleGetRssFeed(req: Request, res: Response) {
  const { workflowId } = req.params;

  try {
    const { data: items, error } = await supabase
      .from("rss_feed_items")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("pub_date", { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).send("Error fetching feed items");
    }

    const feedTitle =
      items?.[0]?.feed_title || "Completed Jobs Feed";
    const feedDescription = `Automated feed of completed jobs`;
    const feedLink = `${req.protocol}://${req.get("host")}/api/rss/${workflowId}`;
    const lastBuildDate =
      items?.[0]?.pub_date ? toRfc2822(items[0].pub_date) : new Date().toUTCString();

    const itemsXml = (items || [])
      .map(
        (item) => `
    <item>
      <title>${escapeXml(item.item_title || "")}</title>
      <description>${escapeXml(item.item_description || "")}</description>
      <link>${escapeXml(item.item_link || feedLink)}</link>
      <guid isPermaLink="false">${escapeXml(item.item_guid)}</guid>
      <pubDate>${toRfc2822(item.pub_date)}</pubDate>
    </item>`
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
    res.setHeader("Cache-Control", "public, max-age=300"); // 5-minute cache
    res.send(xml);
  } catch (err) {
    console.error("RSS feed error:", err);
    res.status(500).send("Internal server error");
  }
}

/**
 * POST /api/rss/:workflowId/items
 * Adds a new item to the RSS feed. Called when a workflow step executes.
 * Body: { item_title, item_description, item_link, feed_title, sub_account_id }
 */
export async function handleAddRssItem(req: Request, res: Response) {
  const { workflowId } = req.params;
  const {
    item_title,
    item_description,
    item_link,
    feed_title,
    sub_account_id,
  } = req.body;

  if (!item_title) {
    return res.status(400).json({ error: "item_title is required" });
  }

  try {
    const { data, error } = await supabase
      .from("rss_feed_items")
      .insert({
        workflow_id: workflowId,
        sub_account_id: sub_account_id || null,
        feed_title: feed_title || "Completed Jobs Feed",
        item_title,
        item_description: item_description || "",
        item_link: item_link || null,
      })
      .select()
      .single();

    if (error) {
      console.error("RSS insert error:", error);
      return res.status(500).json({ error: "Failed to add RSS item" });
    }

    res.json({ success: true, item: data });
  } catch (err) {
    console.error("RSS add item error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
