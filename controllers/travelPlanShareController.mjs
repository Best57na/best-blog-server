import crypto from "crypto";
import pool from "../utils/db.mjs";

const REQUIRED_ARRAYS = ["route", "accommodation", "spots", "food", "captions", "packing"];

function isCompletePlan(plan) {
  return plan && typeof plan === "object" &&
    REQUIRED_ARRAYS.every((key) => Array.isArray(plan[key]) && plan[key].length > 0);
}

export async function saveTravelPlan(req, res) {
  const { origin, destination, dates, style, activities, language, currency, plan, packing } = req.body || {};

  if (!isCompletePlan(plan)) {
    return res.status(400).json({ message: "A complete travel plan is required" });
  }

  const shareToken = crypto.randomBytes(8).toString("hex");

  try {
    const inserted = await pool.query(
      `insert into ai_travel_plans
         (share_token, user_id, origin, destination, dates, style, activities, language, currency, plan, packing)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id, share_token`,
      [
        shareToken,
        req.user.id,
        typeof origin === "string" ? origin.slice(0, 100) : "",
        typeof destination === "string" ? destination.slice(0, 100) : "",
        typeof dates === "string" ? dates.slice(0, 100) : "",
        typeof style === "string" ? style.slice(0, 30) : "",
        JSON.stringify(Array.isArray(activities) ? activities : []),
        typeof language === "string" ? language.slice(0, 10) : "en",
        typeof currency === "string" ? currency.slice(0, 10) : "THB",
        JSON.stringify(plan),
        JSON.stringify(Array.isArray(packing) ? packing : []),
      ]
    );

    return res.status(201).json({ id: inserted.rows[0].id, shareToken: inserted.rows[0].share_token });
  } catch (error) {
    console.error("Failed to save travel plan:", error);
    return res.status(500).json({ message: "Server could not save the travel plan" });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateTravelPlan(req, res) {
  const { id } = req.params;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return res.status(404).json({ message: "Server could not find the requested travel plan" });
  }

  const { plan, packing } = req.body || {};
  if (!isCompletePlan(plan)) {
    return res.status(400).json({ message: "A complete travel plan is required" });
  }

  try {
    const existing = await pool.query(`select user_id from ai_travel_plans where id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Server could not find the requested travel plan" });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: "You can only update your own travel plans" });
    }

    await pool.query(
      `update ai_travel_plans set plan = $1, packing = $2, updated_at = now() where id = $3`,
      [JSON.stringify(plan), JSON.stringify(Array.isArray(packing) ? packing : []), id]
    );

    return res.status(200).json({ message: "Travel plan updated" });
  } catch (error) {
    console.error("Failed to update travel plan:", error);
    return res.status(500).json({ message: "Server could not update the travel plan" });
  }
}

export async function getSharedTravelPlan(req, res) {
  const { shareToken } = req.params;
  if (typeof shareToken !== "string" || !shareToken.trim()) {
    return res.status(404).json({ message: "Trip not found" });
  }

  try {
    const result = await pool.query(
      `select origin, destination, dates, style, activities, language, currency, plan, packing, created_at
       from ai_travel_plans where share_token = $1`,
      [shareToken.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Trip not found" });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to load shared travel plan:", error);
    return res.status(500).json({ message: "Server could not load the trip" });
  }
}
