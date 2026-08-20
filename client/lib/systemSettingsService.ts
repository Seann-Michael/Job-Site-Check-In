import supabaseClient from "@/lib/supabaseClient";

/**
 * Thin access layer over the `system_settings` key/value table
 * (columns: id, key UNIQUE, value jsonb, updated_at).
 *
 * Secrets (SMTP passwords, provider API keys) are NOT stored here — they live
 * in the server environment. Nothing from this table is cached in
 * localStorage; the table is the single source of truth.
 */
export async function getSystemSetting<T extends Record<string, any>>(
  key: string,
): Promise<T | null> {
  const { data, error } = await supabaseClient
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value || typeof data.value !== "object") return null;
  return data.value as T;
}

export async function setSystemSetting(
  key: string,
  value: Record<string, any>,
): Promise<void> {
  const { error } = await supabaseClient
    .from("system_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}

/** Platform branding assets, stored under system_settings.key = "branding". */
export interface BrandingSettings {
  logoUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
}

export const BRANDING_KEY = "branding";

/**
 * Upload a branding asset to the public `public-assets` bucket under `branding/` and
 * return its public URL (cache-busted). The caller persists the URL via
 * setSystemSetting(BRANDING_KEY, ...).
 */
export async function uploadBrandingAsset(
  kind: "logo" | "favicon" | "login-background",
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `branding/${kind}.${ext}`;
  const { error } = await supabaseClient.storage
    .from("public-assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabaseClient.storage.from("public-assets").getPublicUrl(path);
  return `${publicUrl}?v=${Date.now()}`;
}
