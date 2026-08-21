/**
 * RevenueCat (in-app purchases) wrapper — App Store + Google Play.
 *
 * IMPORTANT: `react-native-purchases` is a NATIVE module. It does NOT work in
 * Expo Go (the QR-preview client) and only runs in a development / production
 * build. So every call here is guarded: in Expo Go, on web, or when no public
 * SDK key is configured, the functions no-op and `purchasesAvailable()` returns
 * false — the app still loads and the billing screen falls back to read-only.
 *
 * Purchases are validated by RevenueCat and delivered to our server via the
 * `/api/webhooks/revenuecat` webhook, which writes the same `subscriptions`
 * entitlement row the Stripe web path uses. The client just kicks off the
 * purchase and identifies the user/business so the webhook can attribute it.
 *
 * Configuration (build-time, public keys — safe to ship in the client):
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY, EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

type RNPurchases = typeof import('react-native-purchases').default;

// Keys come from EXPO_PUBLIC_* env at build time (production, real store keys),
// falling back to app.json `extra` (the Test Store sandbox keys, baked in so a
// dev build works out of the box). Env always wins so production can override.
const EXTRA = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? EXTRA.revenuecatIosKey ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? EXTRA.revenuecatAndroidKey ?? '';

// Expo Go can't load native modules; `appOwnership === 'expo'` identifies it.
const isExpoGo = Constants.appOwnership === 'expo';

function apiKey(): string {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return '';
}

/** True only in a real build with a configured key for this platform. */
export function purchasesAvailable(): boolean {
  return !isExpoGo && Platform.OS !== 'web' && apiKey().length > 0;
}

let mod: RNPurchases | null = null;
let configured = false;

async function load(): Promise<RNPurchases | null> {
  if (!purchasesAvailable()) return null;
  if (!mod) {
    // Dynamic import so the native module is never touched in Expo Go.
    mod = (await import('react-native-purchases')).default;
  }
  return mod;
}

/**
 * Configure the SDK once and bind it to the signed-in user. `appUserId` should
 * be the Supabase user id so the webhook can map purchases back to the account.
 * Safe to call repeatedly; re-calls just re-identify the user.
 */
export async function configurePurchases(appUserId?: string): Promise<void> {
  const P = await load();
  if (!P) return;
  try {
    if (!configured) {
      P.configure({ apiKey: apiKey(), appUserID: appUserId });
      configured = true;
    } else if (appUserId) {
      await P.logIn(appUserId);
    }
  } catch {
    // Never let billing setup crash app startup.
  }
}

/**
 * Tag the RevenueCat subscriber with the business the purchase is for. The
 * webhook reads this `business_id` attribute to attach the subscription to the
 * right workspace (with an owner-id fallback server-side).
 */
export async function setPurchaseBusiness(businessId: string): Promise<void> {
  const P = await load();
  if (!P || !businessId) return;
  try {
    P.setAttributes({ business_id: businessId });
  } catch {
    /* no-op */
  }
}

export async function logOutPurchases(): Promise<void> {
  const P = await load();
  if (!P || !configured) return;
  try {
    await P.logOut();
  } catch {
    /* no-op */
  }
}

/** The current offering (set of purchasable packages) from RevenueCat. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const P = await load();
  if (!P) return null;
  try {
    const offerings = await P.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

/** Start a purchase. Throws on real failures so the UI can surface them. */
export async function purchase(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  const P = await load();
  if (!P) return null;
  const { customerInfo } = await P.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const P = await load();
  if (!P) return null;
  try {
    return await P.restorePurchases();
  } catch {
    return null;
  }
}

/** Whether the user currently holds any active entitlement. */
export async function hasActiveEntitlement(): Promise<boolean> {
  const P = await load();
  if (!P) return false;
  try {
    const info = await P.getCustomerInfo();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}
