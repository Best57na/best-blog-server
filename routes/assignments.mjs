import { Router } from "express";
import { validatePostData } from "../middlewares/validatePostData.mjs";
import { createPost } from "../controllers/postController.mjs";

const router = Router();

router.post("/", validatePostData, createPost);

export default router;
