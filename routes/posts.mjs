import { Router } from "express";
import { validatePostData } from "../middlewares/validatePostData.mjs";
import {
  getPosts,
  getPostById,
  updatePost,
  deletePost,
} from "../controllers/postController.mjs";

const router = Router();

router.get("/", getPosts);
router.get("/:postId", getPostById);
router.put("/:postId", validatePostData, updatePost);
router.delete("/:postId", deletePost);

export default router;
