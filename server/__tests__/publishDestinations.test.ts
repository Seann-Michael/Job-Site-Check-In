import { describe, it, expect, vi } from "vitest";

/**
 * Publish destinations.
 *
 * The mobile app's publish screen offers three destinations — Google, website,
 * GoHighLevel — and carries the chosen ones to the server as a *request*; the
 * server decides how, or whether, each is fulfilled. The map was
 * `{ website: ["rss"] }` and nothing else, so every publish to Google or
 * GoHighLevel reported "nothing was published there", for every job, forever.
 *
 * These tests pin the mapping and the honesty of each outcome.
 */

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
  createAnonClient: () => null,
}));

import {
  __DESTINATION_STEP_APPS,
  destinationOutcome,
  AVAILABLE_ACTIONS,
  type StepResult,
} from "../routes/workflows";

/** The destination ids mobile/src/lib/publish.ts can send. */
const MOBILE_DESTINATIONS = ["gmb", "website", "gohighlevel"];

const step = (
  app: string,
  action: string,
  status: "succeeded" | "failed",
  error?: string,
): StepResult => ({
  stepId: `${app}-1`,
  app,
  action,
  status,
  ...(error ? { error } : {}),
});

describe("the destination map", () => {
  it("covers every destination the mobile app can request", () => {
    for (const d of MOBILE_DESTINATIONS) {
      expect(__DESTINATION_STEP_APPS[d], `destination "${d}" must map to a step app`).toBeTruthy();
      expect(__DESTINATION_STEP_APPS[d].length).toBeGreaterThan(0);
    }
  });

  it("routes Google to the gbp step, whose handler exists on the server", () => {
    expect(__DESTINATION_STEP_APPS.gmb).toEqual(["gbp"]);
    expect(AVAILABLE_ACTIONS).toContain("gbp_create_post");
  });

  it("routes GoHighLevel through a webhook step, which is how GHL is reached", () => {
    expect(__DESTINATION_STEP_APPS.gohighlevel).toEqual(["webhook"]);
    expect(AVAILABLE_ACTIONS).toContain("webhook_send_webhook");
  });

  it("maps each destination only to step apps that have a handler", () => {
    const apps = new Set<string>(AVAILABLE_ACTIONS.map((key) => key.split("_")[0]));
    for (const [destination, stepApps] of Object.entries(__DESTINATION_STEP_APPS)) {
      for (const app of stepApps) {
        expect(apps.has(app), `${destination} -> ${app} has no handler`).toBe(true);
      }
    }
  });
});

describe("destinationOutcome", () => {
  it("reports sent when the matching step succeeded", () => {
    const result = destinationOutcome("gmb", [step("gbp", "create_post", "succeeded")]);
    expect(result).toMatchObject({ destination: "gmb", status: "sent" });
  });

  it("reports failed, with the reason, when the matching step failed", () => {
    const result = destinationOutcome(
      "gmb",
      [step("gbp", "create_post", "failed", "Google Business Profile is not connected for this business")],
    );
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("not connected");
  });

  it("says plainly that nothing was published when the workflow has no such step", () => {
    // The honest answer: not an error, and not a success either.
    const result = destinationOutcome("gmb", [step("rss", "add_item", "succeeded")]);
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("no step that publishes to gmb");
  });

  it("does not credit one destination for another destination's step", () => {
    const steps = [step("rss", "add_item", "succeeded")];
    expect(destinationOutcome("website", steps).status).toBe("sent");
    expect(destinationOutcome("gmb", steps).status).toBe("failed");
    expect(destinationOutcome("gohighlevel", steps).status).toBe("failed");
  });

  it("treats an unknown destination as unpublished rather than throwing", () => {
    const result = destinationOutcome("facebook", [step("rss", "add_item", "succeeded")]);
    expect(result.status).toBe("failed");
  });
});
