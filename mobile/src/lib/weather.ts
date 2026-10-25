/**
 * Current conditions for the photo stamp, from Open-Meteo (no key, free for
 * this volume). One lookup per spot per 15 minutes — a crew takes dozens of
 * photos at one address and the weather doesn't change between shots.
 */
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; text: string | null }>();

const CODES: [number[], string][] = [
  [[0], 'Clear'],
  [[1], 'Mostly clear'],
  [[2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67], 'Rain'],
  [[71, 73, 75, 77], 'Snow'],
  [[80, 81, 82], 'Showers'],
  [[85, 86], 'Snow showers'],
  [[95, 96, 99], 'Thunderstorm'],
];

function describe(code: number): string {
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? '';
}

/** e.g. "48°F Partly cloudy · 12 mph wind" — or null when it can't be fetched quickly. */
export async function getWeatherStamp(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(String(response.status));
    const json = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
    };
    const current = json.current;
    if (!current || typeof current.temperature_2m !== 'number') throw new Error('no data');
    const parts = [`${Math.round(current.temperature_2m)}°F`];
    const sky = describe(current.weather_code ?? -1);
    if (sky) parts.push(sky);
    const text = parts.join(' ') + (current.wind_speed_10m && current.wind_speed_10m >= 10 ? ` · ${Math.round(current.wind_speed_10m)} mph wind` : '');
    cache.set(key, { at: Date.now(), text });
    return text;
  } catch {
    // Don't retry on every shot while offline.
    cache.set(key, { at: Date.now(), text: null });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
