API Documentation

This folder contains OpenAPI specs and an interactive Swagger UI for exploring internal and public APIs.

Files:
- onboarding.openapi.yaml — Onboarding API (internal, authenticated)
- oauth.openapi.yaml — OAuth & onboarding/session management endpoints
- payments.openapi.yaml — Payment creation endpoints for Stripe/PayPal/Coinbase
- webhooks.openapi.yaml — Webhook endpoints for payment providers
- swagger.html — Interactive Swagger UI that loads all YAML specs (open in browser at /docs/api/swagger.html when deployed)

Notes:
- The Swagger UI references these YAML files via relative paths. When deployed to Netlify, the docs folder is served statically; adjust paths if you host elsewhere.
- Some endpoints require authorization (JWT). Use a valid Supabase access token when testing private endpoints.
