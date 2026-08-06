import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import rateLimit from "express-rate-limit";

const router = Router();

const anthropic = new Anthropic();

const STYLES = ["Backpacker", "Mid-range", "Luxury"];

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a while" },
});

const RESULT_SCHEMA = {
  type: "object",
  properties: {
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
              description: "Estimated flight duration in Thai, e.g. '6h 30m (บินตรง)'",
            },
            priceRange: {
              type: "string",
              description: "Estimated round-trip price range in Thai Baht, e.g. '฿12,000 - 18,000'",
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
          title: { type: "string", description: "Short Thai step title, e.g. 'จากสนามบินถึงตัวเมือง'" },
          desc: { type: "string", description: "Thai description of this leg: transport options, rough time and cost" },
        },
        required: ["title", "desc"],
        additionalProperties: false,
      },
      description: "3-5 step-by-step directions in Thai from the arrival point (airport/train station/border) all the way to the destination",
    },
    accommodation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Thai name or type of accommodation, e.g. 'โรงแรมย่านใจกลางเมือง'" },
          area: { type: "string", description: "Thai description of the neighborhood/area" },
          priceRange: { type: "string", description: "Price per night range in Thai Baht" },
          desc: { type: "string" },
        },
        required: ["name", "area", "priceRange", "desc"],
        additionalProperties: false,
      },
      description: "Exactly 3 accommodation suggestions in Thai matching the requested travel style",
    },
    weather: {
      type: "string",
      description: "Short weather summary for the travel dates, written in Thai",
    },
    budget: {
      type: "object",
      properties: {
        total: { type: "string", description: "Total estimated budget range in Thai Baht" },
        breakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Thai budget category label, e.g. 'ที่พัก'" },
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
      description: "Thai Instagram-style captions with relevant hashtags",
    },
  },
  required: ["destination", "needsFlight", "flights", "route", "accommodation", "weather", "budget", "spots", "food", "captions"],
  additionalProperties: false,
};

router.post("/travel-plan", limiter, async (req, res) => {
  const { origin, destination, dates, style, activities } = req.body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return res.status(400).json({ message: "Destination is required" });
  }
  if (destination.trim().length > 100) {
    return res.status(400).json({ message: "Destination is too long" });
  }

  const safeDestination = destination.trim();
  const safeOrigin = typeof origin === "string" ? origin.slice(0, 100).trim() : "";
  const safeDates = typeof dates === "string" ? dates.slice(0, 100).trim() : "";
  const safeStyle = STYLES.includes(style) ? style : "Mid-range";
  const safeActivities = Array.isArray(activities)
    ? activities.filter((a) => typeof a === "string").map((a) => a.slice(0, 60)).slice(0, 20)
    : [];

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ message: "AI service is not configured" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system:
        "You are a Thai-speaking travel planning assistant for a travel blog. Given an origin, a destination, and trip preferences, generate a realistic, specific travel plan. Write every user-facing text field (weather, route steps, accommodation, budget labels, spot/food names and descriptions, captions) in natural, friendly Thai matching a travel blogger's tone. Keep monetary amounts in Thai Baht (฿). Decide needsFlight based on real-world geography: false when the origin and destination are close enough to reach by car, bus, train, or ferry (e.g. domestic trips or nearby countries with land/sea routes); true otherwise. Set flights to null when needsFlight is false. Always fill route with 3-5 concrete steps covering the whole journey from the origin to the destination door-to-door (e.g. airport/train station arrival, immigration if international, onward transport, last-mile to the destination area), regardless of needsFlight. Give exactly 3 items each for accommodation, spots, food, and captions. Base estimates on real-world knowledge of the origin and destination; if unsure of exact prices, give a reasonable realistic range instead of refusing. If origin is not specified, assume the traveler is coming from outside the destination country and a flight is required.",
      messages: [
        {
          role: "user",
          content: `Origin: ${safeOrigin || "not specified"}\nDestination: ${safeDestination}\nTravel dates: ${safeDates || "not specified"}\nTravel style: ${safeStyle}\nPreferred activities: ${safeActivities.join(", ") || "not specified"}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ message: "AI could not generate a plan for this request" });
    }
    if (response.stop_reason === "max_tokens") {
      return res.status(502).json({ message: "AI response was too long to complete, please try again" });
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      return res.status(502).json({ message: "AI returned an unexpected response" });
    }

    const plan = JSON.parse(textBlock.text);
    const requiredArrays = ["route", "accommodation", "spots", "food", "captions"];
    if (requiredArrays.some((key) => !Array.isArray(plan[key]) || plan[key].length === 0)) {
      return res.status(502).json({ message: "AI returned an incomplete plan, please try again" });
    }

    plan.generatedAt = new Date().toISOString();

    return res.status(200).json({ plan });
  } catch (error) {
    console.error("AI travel plan generation failed:", error);
    return res.status(502).json({ message: "Failed to generate travel plan" });
  }
});

export default router;
