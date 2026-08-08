const FETCH_TIMEOUT_MS = 5000;
const FORECAST_HORIZON_DAYS = 15;

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const WEATHER_CODES = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "depositing rime fog",
  51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
  61: "slight rain", 63: "moderate rain", 65: "heavy rain",
  71: "slight snow", 73: "moderate snow", 75: "heavy snow",
  80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
  95: "thunderstorm",
};

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Best-effort parse of a free-text `dates` field (e.g. "15-20 Dec 2026", "Dec 15, 2026").
 * Returns { start: Date, end: Date } or null if nothing recognizable was found.
 */
export function parseDateRange(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const cleaned = text.trim();

  const patterns = [
    // "15-20 Dec 2026" / "15-20 December 2026"
    { re: /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/, order: ["d1", "d2", "month", "year"] },
    // "Dec 15-20, 2026"
    { re: /([A-Za-z]{3,})\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})/, order: ["month", "d1", "d2", "year"] },
    // "15 Dec 2026"
    { re: /(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/, order: ["d1", "month", "year"] },
    // "Dec 15, 2026"
    { re: /([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/, order: ["month", "d1", "year"] },
  ];

  for (const { re, order } of patterns) {
    const match = cleaned.match(re);
    if (!match) continue;
    const fields = {};
    order.forEach((key, i) => { fields[key] = match[i + 1]; });
    const month = MONTHS[fields.month?.slice(0, 3).toLowerCase()];
    if (month === undefined) continue;
    const year = Number(fields.year);
    const d1 = Number(fields.d1);
    const d2 = fields.d2 ? Number(fields.d2) : d1;
    const start = new Date(year, month, d1);
    const end = new Date(year, month, d2);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    return { start, end: end < start ? start : end };
  }

  // Fall back to native parsing only for unambiguous, non-range formats
  // (e.g. ISO "2026-12-15" or "December 20, 2026") — native Date parsing
  // mangles range strings like "15-20 Dec 2026", so those must be caught above.
  const native = new Date(cleaned);
  if (!isNaN(native.getTime()) && /\d{4}/.test(cleaned)) return { start: native, end: native };

  return null;
}

/**
 * Geocode a free-text destination to coordinates via Open-Meteo's free geocoding API.
 * Returns { lat, lon, name, country } or null. Takes the top match only — no
 * disambiguation for ambiguous names (e.g. "Paris" France vs. Texas).
 */
export async function geocodeDestination(destination) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination)}&count=1&language=en&format=json`;
  const data = await fetchJSON(url);
  const result = data?.results?.[0];
  if (!result) return null;
  return { lat: result.latitude, lon: result.longitude, name: result.name, country: result.country };
}

function summarizeDaily(daily, label) {
  if (!daily?.time?.length) return null;
  const maxes = daily.temperature_2m_max || [];
  const mins = daily.temperature_2m_min || [];
  const precip = daily.precipitation_sum || daily.precipitation_probability_mean || [];
  const codes = daily.weathercode || [];

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const maxAvg = avg(maxes);
  const minAvg = avg(mins);
  const precipAvg = avg(precip);
  const commonCode = codes.length ? codes[Math.floor(codes.length / 2)] : null;
  const conditions = commonCode !== undefined ? WEATHER_CODES[commonCode] : null;

  const parts = [`${label}:`];
  if (minAvg !== null && maxAvg !== null) parts.push(`around ${Math.round(minAvg)}-${Math.round(maxAvg)}°C`);
  if (conditions) parts.push(`typically ${conditions}`);
  if (precipAvg !== null) parts.push(`precipitation indicator ~${Math.round(precipAvg * 10) / 10}`);
  return parts.join(" ");
}

/**
 * Get a short real-data weather summary string for the given coordinates and
 * free-text travel dates, or null if dates can't be parsed or the API is unreachable.
 * Within the ~15-day forecast horizon, uses the live forecast. Otherwise falls back
 * to last year's same calendar dates from the historical archive as a normals proxy.
 */
export async function getWeatherContext(lat, lon, datesText) {
  const range = parseDateRange(datesText);
  if (!range) return null;

  const now = new Date();
  const daysFromNow = Math.floor((range.start - now) / (1000 * 60 * 60 * 24));

  if (daysFromNow >= 0 && daysFromNow <= FORECAST_HORIZON_DAYS) {
    const start = toISODate(range.start);
    const end = toISODate(range.end);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode&timezone=auto`;
    const data = await fetchJSON(url);
    return summarizeDaily(data?.daily, "Live forecast");
  }

  // Outside the forecast horizon: use last year's same calendar dates as a normals proxy.
  const lastYear = now.getFullYear() - 1;
  const start = new Date(lastYear, range.start.getMonth(), range.start.getDate());
  const end = new Date(lastYear, range.end.getMonth(), range.end.getDate());
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${toISODate(start)}&end_date=${toISODate(end)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
  const data = await fetchJSON(url);
  return summarizeDaily(data?.daily, "Same dates last year (climate reference)");
}
