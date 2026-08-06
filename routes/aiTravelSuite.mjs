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
    flights: {
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
  required: ["destination", "flights", "weather", "budget", "spots", "food", "captions"],
  additionalProperties: false,
};

router.post("/travel-plan", limiter, async (req, res) => {
  const { destination, dates, style, activities } = req.body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return res.status(400).json({ message: "Destination is required" });
  }
  if (destination.trim().length > 100) {
    return res.status(400).json({ message: "Destination is too long" });
  }

  const safeDestination = destination.trim();
  const safeDates = typeof dates === "string" ? dates.slice(0, 100).trim() : "";
  const safeStyle = STYLES.includes(style) ? style : "Mid-range";
  const safeActivities = Array.isArray(activities)
    ? activities.filter((a) => typeof a === "string").slice(0, 10)
    : [];

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ message: "AI service is not configured" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system:
        "You are a Thai-speaking travel planning assistant for a travel blog. Given a destination and trip preferences, generate a realistic, specific travel plan. Write every user-facing text field (weather, budget labels, spot/food names and descriptions, captions) in natural, friendly Thai matching a travel blogger's tone. Keep monetary amounts in Thai Baht (฿). Give exactly 3 items each for spots, food, and captions. Base estimates on real-world knowledge of the destination; if unsure of exact prices, give a reasonable realistic range instead of refusing.",
      messages: [
        {
          role: "user",
          content: `Destination: ${safeDestination}\nTravel dates: ${safeDates || "not specified"}\nTravel style: ${safeStyle}\nPreferred activities: ${safeActivities.join(", ") || "not specified"}`,
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ message: "AI could not generate a plan for this request" });
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      return res.status(502).json({ message: "AI returned an unexpected response" });
    }

    const plan = JSON.parse(textBlock.text);
    plan.generatedAt = new Date().toISOString();

    return res.status(200).json({ plan });
  } catch (error) {
    console.error("AI travel plan generation failed:", error);
    return res.status(502).json({ message: "Failed to generate travel plan" });
  }
});

export default router;
