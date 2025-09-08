cURL examples — Onboarding & Payments

Base variables
- Replace {{BASE_URL}} with your site URL (eg. https://app.example.com)
- Replace {{TOKEN}} with an authenticated Supabase access token (Bearer)

Onboarding — list tasks
curl -s -H "Authorization: Bearer {{TOKEN}}" "{{BASE_URL}}/.netlify/functions/onboarding-api?action=tasks"

Onboarding — complete a task
curl -X POST "{{BASE_URL}}/.netlify/functions/onboarding-api?action=complete" \
  -H "Authorization: Bearer {{TOKEN}}" \
  -H "Content-Type: application/json" \
  -d '{"task_id":"<TASK_ID>","status":"completed"}'

Create Stripe Checkout (serverless function)
curl -X POST "{{BASE_URL}}/.netlify/functions/create-checkout-stripe" \
  -H "Content-Type: application/json" \
  -d '{"amount":49.99,"mode":"one_time","description":"Pro plan","metadata":{"user_id":"<USER_ID>"}}'

Create PayPal Checkout (serverless function)
curl -X POST "{{BASE_URL}}/.netlify/functions/create-checkout-paypal" \
  -H "Content-Type: application/json" \
  -d '{"amount":49.99,"mode":"one_time","description":"Agency onboarding","metadata":{"user_id":"<USER_ID>"}}'

Create Coinbase Commerce Charge (serverless function)
curl -X POST "{{BASE_URL}}/.netlify/functions/create-checkout-coinbase" \
  -H "Content-Type: application/json" \
  -d '{"amount":19.99,"description":"Credits pack","metadata":{"user_id":"<USER_ID>"}}'

Stripe webhook replay (using Stripe CLI)
# Listen then forward events to local dev server
stripe listen --forward-to "{{BASE_URL}}/api/webhook-stripe"
# Replay an event
stripe trigger checkout.session.completed

PayPal webhook replay (manual)
# Use PayPal sandbox to resend webhook events from the dashboard to your webhook endpoint

Coinbase Commerce webhook replay (manual)
# Coinbase dashboard allows you to resend events; ensure shared secret matches COINBASE_COMMERCE_SHARED_SECRET

Notes
- Webhook endpoints expect provider-specific headers (Stripe-Signature, PayPal transmission headers, or X-CC-Webhook-Signature). Do not send plain JSON without proper signing when testing production endpoints.
