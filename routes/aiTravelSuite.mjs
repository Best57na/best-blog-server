import { Router } from "express";
import rateLimit from "express-rate-limit";
import protectUser from "../middlewares/protectUser.mjs";
import { generatePlan, generatePlanGroupA, generatePlanGroupBC, refinePlan } from "../controllers/aiTravelSuiteController.mjs";
import { saveTravelPlan, updateTravelPlan, getSharedTravelPlan } from "../controllers/travelPlanShareController.mjs";

const router = Router();

const saveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a while" },
});

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a while" },
});

// Grouped generation costs 2 sequential Claude calls per plan (group-a, then group-bc's
// internal Promise.all) instead of 1 — lower limit keeps per-IP cost roughly comparable.
const groupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a while" },
});

const refineLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a while" },
});

router.post("/travel-plan", limiter, generatePlan);
router.post("/travel-plan/group-a", groupLimiter, generatePlanGroupA);
router.post("/travel-plan/group-bc", groupLimiter, generatePlanGroupBC);
router.post("/travel-plan/refine", refineLimiter, refinePlan);

router.post("/travel-plan/save", protectUser, saveLimiter, saveTravelPlan);
router.put("/travel-plan/:id", protectUser, saveLimiter, updateTravelPlan);
router.get("/travel-plan/shared/:shareToken", getSharedTravelPlan);

export default router;
