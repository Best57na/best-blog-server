export const STYLES = ["Backpacker", "Mid-range", "Luxury"];

export const LANGUAGE_NAMES = {
  en: "English",
  th: "Thai",
  zh: "Chinese",
  es: "Spanish",
  hi: "Hindi",
  fr: "French",
  ar: "Arabic",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  de: "German",
  ko: "Korean",
  vi: "Vietnamese",
  id: "Indonesian",
  it: "Italian",
  tr: "Turkish",
  bn: "Bengali",
};

export const CURRENCIES = {
  THB: { name: "Thai Baht", symbol: "฿" },
  USD: { name: "US Dollar", symbol: "$" },
  EUR: { name: "Euro", symbol: "€" },
  GBP: { name: "British Pound", symbol: "£" },
  JPY: { name: "Japanese Yen", symbol: "¥" },
  KRW: { name: "South Korean Won", symbol: "₩" },
  CNY: { name: "Chinese Yuan", symbol: "¥" },
  INR: { name: "Indian Rupee", symbol: "₹" },
  VND: { name: "Vietnamese Dong", symbol: "₫" },
  IDR: { name: "Indonesian Rupiah", symbol: "Rp" },
  SGD: { name: "Singapore Dollar", symbol: "S$" },
  AUD: { name: "Australian Dollar", symbol: "A$" },
  CAD: { name: "Canadian Dollar", symbol: "C$" },
  MYR: { name: "Malaysian Ringgit", symbol: "RM" },
  PHP: { name: "Philippine Peso", symbol: "₱" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$" },
  TWD: { name: "New Taiwan Dollar", symbol: "NT$" },
  CHF: { name: "Swiss Franc", symbol: "Fr" },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$" },
};

const FIELDS = {
  destination: { type: "string" },
  needsFlight: {
    type: "boolean",
    description: "Whether flying is realistically required to get from the origin to the destination. False for nearby/domestic trips reachable by land or sea.",
  },
  flights: {
    anyOf: [
      {
        type: "object",
        properties: {
          duration: {
            type: "string",
            description: "Estimated flight duration, e.g. '6h 30m (direct)'",
          },
          priceRange: {
            type: "string",
            description: "Estimated round-trip price range in the requested currency, e.g. '$350 - 520'",
          },
        },
        required: ["duration", "priceRange"],
        additionalProperties: false,
      },
      { type: "null" },
    ],
    description: "Flight estimate, or null when needsFlight is false",
  },
  route: {
    type: "array",
    items: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short step title, e.g. 'Airport to city center'" },
        desc: { type: "string", description: "Description of this leg: transport options, rough time and cost" },
      },
      required: ["title", "desc"],
      additionalProperties: false,
    },
    description: "3-5 step-by-step directions from the arrival point (airport/train station/border) all the way to the destination",
  },
  accommodation: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name or type of accommodation, e.g. 'City-center hotel'" },
        area: { type: "string", description: "Description of the neighborhood/area" },
        priceRange: { type: "string", description: "Price per night range in the requested currency" },
        desc: { type: "string" },
      },
      required: ["name", "area", "priceRange", "desc"],
      additionalProperties: false,
    },
    description: "Exactly 3 accommodation suggestions matching the requested travel style",
  },
  weather: {
    type: "string",
    description: "Short weather summary for the travel dates",
  },
  budget: {
    type: "object",
    properties: {
      total: { type: "string", description: "Total estimated budget range in the requested currency" },
      breakdown: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Budget category label, e.g. 'Accommodation'" },
            percent: { type: "integer" },
            amount: { type: "string" },
          },
          required: ["label", "percent", "amount"],
          additionalProperties: false,
        },
      },
    },
    required: ["total", "breakdown"],
    additionalProperties: false,
  },
  spots: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        desc: { type: "string" },
      },
      required: ["name", "desc"],
      additionalProperties: false,
    },
  },
  food: {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        desc: { type: "string" },
      },
      required: ["name", "desc"],
      additionalProperties: false,
    },
  },
  captions: {
    type: "array",
    items: { type: "string" },
    description: "Instagram-style captions with relevant hashtags",
  },
  packing: {
    type: "array",
    items: {
      type: "object",
      properties: {
        category: { type: "string", description: "Packing category name, e.g. 'Clothing', 'Electronics', 'Documents'" },
        items: {
          type: "array",
          items: { type: "string" },
          description: "Specific packing items for this category",
        },
      },
      required: ["category", "items"],
      additionalProperties: false,
    },
    description: "3-5 packing categories tailored to this specific trip's weather, destination, style, and activities (e.g. cold-weather gear only if the destination is cold, hiking gear if activities include hiking)",
  },
};

function schemaOf(keys, required = keys) {
  return {
    type: "object",
    properties: Object.fromEntries(keys.map((key) => [key, FIELDS[key]])),
    required,
    additionalProperties: false,
  };
}

export const RESULT_SCHEMA = schemaOf([
  "destination", "needsFlight", "flights", "route", "accommodation", "weather", "budget", "spots", "food", "captions", "packing",
]);

// Group A: trip identity + logistics — generated first, everything else depends on it.
export const GROUP_A_SCHEMA = schemaOf(["destination", "needsFlight", "flights", "route", "weather", "budget"]);

// Group B and C both only need group A's output as read-only context; they don't depend on each other.
export const GROUP_B_SCHEMA = schemaOf(["accommodation", "spots", "food"]);
export const GROUP_C_SCHEMA = schemaOf(["captions", "packing"]);

const BASE_CLAUSE = (languageName, currencyName, currencySymbol) =>
  "You are a travel planning assistant for a travel blog. Given an origin, a destination, and trip preferences, generate a realistic, specific travel plan. " +
  `Write every user-facing text field in natural, friendly ${languageName} matching a travel blogger's tone. ` +
  `Keep all monetary amounts in ${currencyName} (${currencySymbol}). ` +
  "Base estimates on real-world knowledge of the origin and destination; if unsure of exact prices, give a reasonable realistic range instead of refusing.";

const LOGISTICS_CLAUSE = (weatherContext) =>
  " Decide needsFlight based on real-world geography: false when the origin and destination are close enough to reach by car, bus, train, or ferry (e.g. domestic trips or nearby countries with land/sea routes); true otherwise. Set flights to null when needsFlight is false. " +
  "Always fill route with 3-5 concrete steps covering the whole journey from the origin to the destination door-to-door (e.g. airport/train station arrival, immigration if international, onward transport, last-mile to the destination area), regardless of needsFlight. " +
  "If origin is not specified, assume the traveler is coming from outside the destination country and a flight is required." +
  (weatherContext ? ` Live weather data for this trip: ${weatherContext}. Ground the weather field in this data rather than guessing.` : "");

const DETAILS_CLAUSE =
  " Give exactly 3 items each for accommodation, spots, food, and captions. " +
  "For packing, tailor 3-5 categories and their items specifically to this trip: consider the destination's actual climate for the given dates, the travel style, and the selected activities (e.g. include hiking boots and a rain cover only if hiking/nature activities were chosen, swimwear only for beach destinations, warm layers only for cold destinations) — do not default to a generic list.";

/**
 * `focus` selects which schema-specific instructions to include:
 * - "full" (default): the original single-call endpoint, both logistics + details clauses.
 * - "group-a": destination/flights/route/weather/budget only.
 * - "group-bc": accommodation/spots/food/captions/packing only (weatherContext should be
 *   group A's already-generated weather summary text, not raw sensor data, to stay coherent).
 */
export function buildSystemPrompt({ languageName, currencyName, currencySymbol, weatherContext, focus = "full" }) {
  const base = BASE_CLAUSE(languageName, currencyName, currencySymbol);
  if (focus === "group-a") return base + LOGISTICS_CLAUSE(weatherContext);
  if (focus === "group-bc") return base + DETAILS_CLAUSE;
  return base + LOGISTICS_CLAUSE(weatherContext) + DETAILS_CLAUSE;
}
