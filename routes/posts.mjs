import { Router } from "express";
import { validatePostData } from "../middlewares/validatePostData.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import {
  getPosts,
  getPostById,
  updatePost,
  deletePost,
} from "../controllers/postController.mjs";

const router = Router();

router.get("/", getPosts);
router.get("/:postId", getPostById);
router.put("/:postId", protectAdmin, validatePostData, updatePost);
router.delete("/:postId", protectAdmin, deletePost);

export default router;
