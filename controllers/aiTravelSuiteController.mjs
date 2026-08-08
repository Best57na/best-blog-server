import Anthropic from "@anthropic-ai/sdk";
import {
  STYLES, RESULT_SCHEMA, GROUP_A_SCHEMA, GROUP_B_SCHEMA, GROUP_C_SCHEMA,
  LANGUAGE_NAMES, CURRENCIES, buildSystemPrompt,
} from "../utils/travelPlanPrompt.mjs";
import { geocodeDestination, getWeatherContext } from "../utils/openMeteo.mjs";

const anthropic = new Anthropic();

const REQUIRED_ARRAYS = ["route", "accommodation", "spots", "food", "captions", "packing"];

function parseTripInput(body) {
  const { origin, destination, dates, style, activities, language, currency } = body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return { error: { status: 400, message: "Destination is required" } };
  }
  if (destination.trim().length > 100) {
    return { error: { status: 400, message: "Destination is too long" } };
  }

  const safeCurrency = CURRENCIES[currency] ? currency : "THB";

  return {
    input: {
      safeOrigin: typeof origin === "string" ? origin.slice(0, 100).trim() : "",
      safeDestination: destination.trim(),
      safeDates: typeof dates === "string" ? dates.slice(0, 100).trim() : "",
      safeStyle: STYLES.includes(style) ? style : "Mid-range",
      safeActivities: Array.isArray(activities)
        ? activities.filter((a) => typeof a === "string").map((a) => a.slice(0, 60)).slice(0, 20)
        : [],
      languageName: LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en,
      currencyName: CURRENCIES[safeCurrency].name,
      currencySymbol: CURRENCIES[safeCurrency].symbol,
    },
  };
}

function tripContextMessage({ safeOrigin, safeDestination, safeDates, safeStyle, safeActivities }) {
  return `Origin: ${safeOrigin || "not specified"}\nDestination: ${safeDestination}\nTravel dates: ${safeDates || "not specified"}\nTravel style: ${safeStyle}\nPreferred activities: ${safeActivities.join(", ") || "not specified"}`;
}

async function callClaude({ schema, system, messages, maxTokens }) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { format: { type: "json_schema", schema } },
  });

  if (response.stop_reason === "refusal") {
    throw Object.assign(new Error("refusal"), { status: 422, message: "AI could not generate a plan for this request" });
  }
  if (response.stop_reason === "max_tokens") {
    throw Object.assign(new Error("max_tokens"), { status: 502, message: "AI response was too long to complete, please try again" });
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw Object.assign(new Error("no_text_block"), { status: 502, message: "AI returned an unexpected response" });
  }

  return JSON.parse(textBlock.text);
}

function requireAnthropicKey(res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ message: "AI service is not configured" });
    return false;
  }
  return true;
}

export async function generatePlan(req, res) {
  const { input, error } = parseTripInput(req.body);
  if (error) return res.status(error.status).json({ message: error.message });
  if (!requireAnthropicKey(res)) return;

  let weatherContext = null;
  try {
    const geo = await geocodeDestination(input.safeDestination);
    if (geo) weatherContext = await getWeatherContext(geo.lat, geo.lon, input.safeDates);
  } catch (error) {
    console.error("Weather grounding failed, falling back to AI estimate:", error);
    weatherContext = null;
  }

  try {
    const plan = await callClaude({
      schema: RESULT_SCHEMA,
      system: buildSystemPrompt({ ...input, weatherContext }),
      messages: [{ role: "user", content: tripContextMessage(input) }],
      maxTokens: 5120,
    });

    if (REQUIRED_ARRAYS.some((key) => !Array.isArray(plan[key]) || plan[key].length === 0)) {
      return res.status(502).json({ message: "AI returned an incomplete plan, please try again" });
    }

    plan.generatedAt = new Date().toISOString();
    plan.weatherSource = weatherContext ? "live-data" : "ai-estimated";

    return res.status(200).json({ plan });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("AI travel plan generation failed:", error);
    return res.status(502).json({ message: "Failed to generate travel plan" });
  }
}

export async function generatePlanGroupA(req, res) {
  const { input, error } = parseTripInput(req.body);
  if (error) return res.status(error.status).json({ message: error.message });
  if (!requireAnthropicKey(res)) return;

  let weatherContext = null;
  try {
    const geo = await geocodeDestination(input.safeDestination);
    if (geo) weatherContext = await getWeatherContext(geo.lat, geo.lon, input.safeDates);
  } catch (error) {
    console.error("Weather grounding failed, falling back to AI estimate:", error);
    weatherContext = null;
  }

  try {
    const groupA = await callClaude({
      schema: GROUP_A_SCHEMA,
      system: buildSystemPrompt({ ...input, weatherContext, focus: "group-a" }),
      messages: [{ role: "user", content: tripContextMessage(input) }],
      maxTokens: 2048,
    });

    if (!Array.isArray(groupA.route) || groupA.route.length === 0) {
      return res.status(502).json({ message: "AI returned an incomplete plan, please try again" });
    }

    groupA.generatedAt = new Date().toISOString();
    groupA.weatherSource = weatherContext ? "live-data" : "ai-estimated";

    return res.status(200).json({ groupA });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("AI travel plan (group A) generation failed:", error);
    return res.status(502).json({ message: "Failed to generate travel plan" });
  }
}

const MAX_INSTRUCTION_LENGTH = 300;
const MAX_CURRENT_PLAN_BYTES = 20 * 1024;

export async function refinePlan(req, res) {
  const { input, error } = parseTripInput(req.body);
  if (error) return res.status(error.status).json({ message: error.message });
  if (!requireAnthropicKey(res)) return;

  const { currentPlan, instruction } = req.body || {};

  if (typeof instruction !== "string" || !instruction.trim()) {
    return res.status(400).json({ message: "Instruction is required" });
  }
  if (instruction.trim().length > MAX_INSTRUCTION_LENGTH) {
    return res.status(400).json({ message: "Instruction is too long" });
  }
  if (!currentPlan || typeof currentPlan !== "object") {
    return res.status(400).json({ message: "Current plan is required" });
  }
  if (REQUIRED_ARRAYS.some((key) => !Array.isArray(currentPlan[key]) || currentPlan[key].length === 0)) {
    return res.status(400).json({ message: "Current plan is incomplete" });
  }

  const currentPlanJSON = JSON.stringify(currentPlan);
  if (Buffer.byteLength(currentPlanJSON, "utf8") > MAX_CURRENT_PLAN_BYTES) {
    return res.status(400).json({ message: "Current plan is too large" });
  }

  try {
    const plan = await callClaude({
      schema: RESULT_SCHEMA,
      system: buildSystemPrompt({ ...input }),
      messages: [
        { role: "user", content: tripContextMessage(input) },
        { role: "assistant", content: currentPlanJSON },
        { role: "user", content: instruction.trim() },
      ],
      maxTokens: 5120,
    });

    if (REQUIRED_ARRAYS.some((key) => !Array.isArray(plan[key]) || plan[key].length === 0)) {
      return res.status(502).json({ message: "AI returned an incomplete plan, please try again" });
    }

    plan.generatedAt = new Date().toISOString();
    plan.weatherSource = typeof currentPlan.weatherSource === "string" ? currentPlan.weatherSource : "ai-estimated";

    return res.status(200).json({ plan });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("AI travel plan refine failed:", error);
    return res.status(502).json({ message: "Failed to refine travel plan" });
  }
}

export async function generatePlanGroupBC(req, res) {
  const { input, error } = parseTripInput(req.body);
  if (error) return res.status(error.status).json({ message: error.message });
  if (!requireAnthropicKey(res)) return;

  const weatherSummary = typeof req.body?.weather === "string" ? req.body.weather.slice(0, 1000) : "";
  const contextMessage = `${tripContextMessage(input)}\nWeather summary already shared with the traveler: ${weatherSummary || "not available"}`;

  try {
    const [groupB, groupC] = await Promise.all([
      callClaude({
        schema: GROUP_B_SCHEMA,
        system: buildSystemPrompt({ ...input, focus: "group-bc" }),
        messages: [{ role: "user", content: contextMessage }],
        maxTokens: 2560,
      }),
      callClaude({
        schema: GROUP_C_SCHEMA,
        system: buildSystemPrompt({ ...input, focus: "group-bc" }),
        messages: [{ role: "user", content: contextMessage }],
        maxTokens: 2048,
      }),
    ]);

    const merged = { ...groupB, ...groupC };
    if (REQUIRED_ARRAYS.some((key) => key in merged && (!Array.isArray(merged[key]) || merged[key].length === 0))) {
      return res.status(502).json({ message: "AI returned an incomplete plan, please try again" });
    }

    return res.status(200).json(merged);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("AI travel plan (group B/C) generation failed:", error);
    return res.status(502).json({ message: "Failed to generate travel plan" });
  }
}
