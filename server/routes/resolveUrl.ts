import { Request, Response } from "express";

/**
 * Resolves a short Google Maps URL (maps.app.goo.gl, share.google, etc.)
 * by following redirects server-side (avoids browser CORS restrictions).
 * Returns the final expanded URL.
 */
export async function handleResolveUrl(req: Request, res: Response) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  try {
    // Follow the redirect chain until we hit the final URL
    let current = url;
    let hops = 0;
    const maxHops = 5;

    while (hops < maxHops) {
      const response = await fetch(current, {
        method: "HEAD",
        redirect: "manual", // Don't auto-follow so we can capture each hop
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GoogleMapsURLResolver/1.0)",
        },
      });

      const location = response.headers.get("location");

      // If no redirect, we've reached the final destination
      if (!location || (response.status !== 301 && response.status !== 302 && response.status !== 307 && response.status !== 308)) {
        // Try GET if HEAD doesn't give us a redirect (some servers don't support HEAD)
        if (hops === 0 && !location) {
          const getResponse = await fetch(current, {
            method: "GET",
            redirect: "manual",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; GoogleMapsURLResolver/1.0)",
            },
          });
          const getLocation = getResponse.headers.get("location");
          if (getLocation) {
            current = getLocation.startsWith("http") ? getLocation : new URL(getLocation, current).href;
            hops++;
            continue;
          }
        }
        break;
      }

      current = location.startsWith("http")
        ? location
        : new URL(location, current).href;
      hops++;
    }

    return res.json({ resolvedUrl: current });
  } catch (error: any) {
    console.error("URL resolution error:", error);
    return res.status(500).json({ error: "Failed to resolve URL", details: error.message });
  }
}
