Payments integration environment variables

Set these environment variables in your Netlify site (or hosting) to enable payments and webhooks.

Supabase
- SUPABASE_URL: Your Supabase project URL (eg. https://xyz.supabase.co)
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-side only)
- SUPABASE_ANON_KEY: Supabase anon/public key (optional for some operations)

Stripe
- STRIPE_SECRET_KEY: Your Stripe secret key (sk_live_...)
- STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret for receiving webhooks

PayPal
- PAYPAL_CLIENT_ID: PayPal REST API client ID
- PAYPAL_CLIENT_SECRET: PayPal REST API secret
- PAYPAL_API_BASE: (optional) API base URL, default uses sandbox (https://api-m.sandbox.paypal.com). For live replace with https://api-m.paypal.com
- PAYPAL_PLAN_ID: (required for subscriptions) Billing plan id to create subscriptions from
- PAYPAL_WEBHOOK_ID: The PayPal webhook ID used to verify incoming webhook signatures

Coinbase Commerce
- COINBASE_COMMERCE_API_KEY: Coinbase Commerce API key for creating charges
- COINBASE_COMMERCE_SHARED_SECRET: Coinbase Commerce webhook shared secret for verifying webhooks
- COINBASE_COMMERCE_API_VERSION: (optional) API version header, default 2018-03-22

Site / Redirect settings
- SITE_URL: Publicly accessible base URL of your site (eg. https://myapp.example). Netlify sets this automatically if you use their hostname; otherwise set manually.

Webhook endpoints (configure these URLs in provider dashboards):
- Stripe webhook URL: <SITE_URL>/.netlify/functions/webhook-stripe
- PayPal webhook URL: <SITE_URL>/.netlify/functions/webhook-paypal
- Coinbase webhook URL: <SITE_URL>/.netlify/functions/webhook-coinbase

Notes and recommendations
- Keep all secret keys (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, PAYPAL_CLIENT_SECRET, COINBASE_COMMERCE_SHARED_SECRET) only in server environment variables; never expose them client-side.
- For PayPal subscription mapping, include metadata.user_id when creating subscriptions (the create-checkout-paypal function sends this as custom_id). Webhook handlers will try to map custom_id -> user_profiles.id.
- For Stripe, set metadata.user_id or customer so webhooks can map back to a user (the create-checkout-stripe function supports persisting sessions). The webhook handler uses stripe_customer_id in user_profiles to locate users.
- For Coinbase, include metadata.user_id on charge creation to link charges to users.

Netlify specifics
- Add the above variables in the Netlify dashboard under Site settings -> Build & deploy -> Environment -> Environment variables.
- Confirm that functions are exposed at /.netlify/functions/*. If you want custom paths (eg. /api/webhooks/paypal) add redirects in netlify.toml to route to the functions endpoint.

Security
- Rotate keys if they are accidentally leaked.
- Use the SUPABASE_SERVICE_ROLE_KEY only in server-side code (Netlify functions). Do not embed service role key in client builds.

If you want, I can also add a small verification script or guide showing how to test each provider's webhook flow using their test tools.
