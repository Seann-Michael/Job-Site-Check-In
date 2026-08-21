# In-App Purchases (App Store + Google Play) via RevenueCat

This document describes how mobile subscriptions work and the exact steps to
take them live. The **code is built and dormant** — like Stripe, it activates
only once the keys/products below exist. Nothing here changes web billing:
Stripe remains the web payment provider; IAP is the in-app path, and both feed
the same entitlement model.

## How it fits together

```
 iPhone / Android app
   │  (RevenueCat SDK: react-native-purchases)
   │  user buys via StoreKit (iOS) / Play Billing (Android)
   ▼
 RevenueCat  ──validates the receipt, tracks the subscription──┐
   │                                                           │
   │  webhook: POST /api/webhooks/revenuecat                   │
   ▼                                                           │
 Our server (server/routes/revenuecat.ts, service role)        │
   │  upserts the business's single `subscriptions` row        │
   │  appends to `billing_records`                             │
   ▼                                                           │
 subscriptions.status + plan  ←── the ONE thing feature-gates read
```

Feature-gating never asks "did they pay via Apple/Google/Stripe" — it reads
`subscriptions.status` (`active | trialing | past_due | canceled | comped`) and
the linked plan. A purchase on any rail unlocks the same account.

### Account & business binding

The app calls `Purchases.logIn(<supabase user id>)`, so RevenueCat's
`app_user_id` **is** the user id. It also sets a `business_id` subscriber
attribute (the workspace being subscribed). The webhook attaches the
subscription to a business by:

1. the `business_id` subscriber attribute if present, else
2. the business owned by that user (`businesses.owner_id = app_user_id`).

## Prerequisites you must set up (I can't do these)

These require your developer accounts, banking, and legal agreements.

### 1. RevenueCat (the hub)

1. Create a free RevenueCat account and a **Project**.
2. Add two **Apps** to the project: one iOS, one Android.
3. Copy the **public SDK keys** (one per platform) — these go in the mobile
   build as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
4. Create an **Entitlement** named `pro` (this is the "is subscribed" flag).
5. Create **Products** (see IDs below) and attach them to an **Offering**
   named `default` with a Package per plan. The app renders
   `offering.current.availablePackages`.
6. Under **Integrations → Webhooks**, add
   `https://app.mylocalseoranker.com/api/webhooks/revenuecat` and set the
   **Authorization header** value — this must equal the server's
   `REVENUECAT_WEBHOOK_AUTH`.

### 2. Apple (App Store Connect)

1. Apple Developer Program membership ($99/yr).
2. App record for bundle id `com.localseoranker.app`.
3. Agreements, Tax, and Banking completed (subscriptions won't sell without it).
4. Create **auto-renewable subscription** products in a subscription group,
   using the product IDs below.
5. Create an **App Store Connect API key** (In-App Purchase key) and upload it
   to RevenueCat so it can validate and receive Apple notifications.

### 3. Google (Play Console)

1. Play Console account ($25 one-time).
2. App record for package `com.localseoranker.app`.
3. Create **subscription** products with the product IDs below (each with a
   base plan).
4. Create a **service account** with Play Developer API access and connect it
   to RevenueCat (enables validation + Real-Time Developer Notifications).

## Product IDs to create (keep them identical across stores)

| Plan    | Product ID (Apple & Google) | RevenueCat entitlement |
| ------- | --------------------------- | ---------------------- |
| Starter | `starter_monthly`           | `pro`                  |
| Pro     | `pro_monthly`               | `pro`                  |
| Agency  | `agency_monthly`            | `pro`                  |

(Add annual variants like `pro_annual` if you want them.)

Then map each plan row to its product IDs so the webhook can resolve the plan.
Either via the super-admin plan editor or SQL:

```sql
update public.plans set apple_product_id = 'pro_monthly',
                        google_product_id = 'pro_monthly',
                        revenuecat_entitlement_id = 'pro'
where name = 'Pro';
```

## Environment variables

Server (DigitalOcean, already present as encrypted keys in `.do/app.yaml`):

| Var                       | Purpose                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `REVENUECAT_WEBHOOK_AUTH` | Must match the Authorization header set in RevenueCat webhook |
| `REVENUECAT_API_KEY`      | RevenueCat REST secret (optional; for future server lookups)  |

Mobile (build-time, public — safe to ship):

| Var                                  | Purpose                       |
| ------------------------------------ | ----------------------------- |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`     | RevenueCat iOS public SDK key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public key |

## Testing — needs a development build, NOT Expo Go

`react-native-purchases` is native, so **it does not run in Expo Go** (the QR
preview). In Expo Go the billing screen simply hides the in-app "Upgrade"
section and everything else works. To test real purchases:

1. Build a dev client: `eas build --profile development --platform ios` (and
   `android`), or `npx expo run:ios` / `run:android` on a machine with the
   native toolchains.
2. iOS: add a **Sandbox tester** in App Store Connect and sign in on the device.
3. Android: add **license testers** in Play Console and use an internal-testing
   track.
4. Purchases in sandbox fire the same webhook (with `environment: SANDBOX`), so
   you can watch `subscriptions` / `billing_records` update end to end.

## Where the code lives

- Server webhook: `server/routes/revenuecat.ts` (+ route in `server/index.ts`).
- Tests: `server/__tests__/revenuecat.test.ts`.
- DB: migration `supabase/migrations/20260820017000_iap_revenuecat.sql`
  (adds `subscriptions.provider/store/...`, `plans.*_product_id`,
  widens `billing_records.payment_provider`).
- Mobile SDK wrapper: `mobile/src/lib/purchases.ts` (guarded; no-ops in Expo Go).
- Mobile wiring: `mobile/src/providers/auth-provider.tsx` (logs the user into
  RevenueCat) and `mobile/src/app/settings/billing.tsx` (offering + restore UI).

## Store-policy note

Selling a digital subscription **inside** the iOS/Android app must go through
StoreKit / Play Billing (this integration), and the stores take ~15–30%.
Buying on the **web** stays on Stripe with no store cut. In the US you may also
link out from the app to the web checkout; that's a separate option and not
required for this integration.
