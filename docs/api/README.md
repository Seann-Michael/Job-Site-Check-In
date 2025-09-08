API Documentation

This folder contains OpenAPI specs and an interactive Swagger UI for exploring internal and public APIs.

Files:
- onboarding.openapi.yaml — Onboarding API (internal, authenticated)
- oauth.openapi.yaml — OAuth & onboarding/session management endpoints
- payments.openapi.yaml — Payment creation endpoints for Stripe/PayPal/Coinbase
- payments-expanded.openapi.yaml — Payments with concrete request/response examples and webhook schemas
- webhooks.openapi.yaml — Webhook endpoints for payment providers
- webhooks-expanded.json — Expanded webhook examples (JSON)
- swagger.html — Interactive Swagger UI that loads all specs (open in browser at /docs/api/swagger.html when deployed)
- examples/curl_examples.md — cURL examples for onboarding and payment flows
- examples/stripe_events_examples.md — sample Stripe webhook payloads
- examples/paypal_events_examples.md — sample PayPal webhook payloads
- postman_collection.json — Postman collection (v2.1) for common requests

Notes:
- The Swagger UI references these YAML/JSON files via relative paths. When deployed to Netlify, the docs folder is served statically; adjust paths if you host elsewhere.
- Some endpoints require authorization (JWT). Use a valid Supabase access token when testing private endpoints.
- Use the expanded specs and example payloads when you need concrete payload examples for testing provider integrations and webhook replay.
- Import docs/api/postman_collection.json into Postman and set {{base_url}} and {{auth_token}} environment variables before testing.
