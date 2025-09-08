import type { Handler } from "@netlify/functions";

const FEDERAL_SUFFIXES = (process.env.FEDERAL_DOMAIN_SUFFIXES || ".gov,.mil").split(",").map(s => s.trim().toLowerCase());

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, body: "", headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } };

    const body = event.body ? JSON.parse(event.body) : {};
    const email = (body.email || body.domain || "").toLowerCase();
    if (!email) return { statusCode: 400, body: JSON.stringify({ success: false, error: 'email is required' }), headers: { 'Content-Type': 'application/json' } };

    // Extract domain
    const domain = email.includes("@") ? email.split("@").pop() || "" : email;
    const isFederal = FEDERAL_SUFFIXES.some(suf => domain.endsWith(suf));

    return { statusCode: 200, body: JSON.stringify({ success: true, isFederal: isFederal, domain }), headers: { 'Content-Type': 'application/json' } };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err?.message || 'Server error' }), headers: { 'Content-Type': 'application/json' } };
  }
};
