import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { validatePostData } from "../middlewares/validatePostData.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import {
  getPosts,
  getPostById,
  updatePost,
  deletePost,
} from "../controllers/postController.mjs";

const supabaseStorage = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = Router();

const multerUpload = multer({ storage: multer.memoryStorage() });
const imageFileUpload = multerUpload.fields([
  { name: "imageFile", maxCount: 1 },
]);

async function resolveImageUrl(req, res, next) {
  const file = req.files?.imageFile?.[0];
  if (!file) return next();

  try {
    const bucketName = "my-personal-blog";
    const filePath = `posts/${Date.now()}_${file.originalname}`;
    const { data, error } = await supabaseStorage.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabaseStorage.storage.from(bucketName).getPublicUrl(data.path);
    req.body.image = publicUrl;
    next();
  } catch (error) {
    res.status(500).json({ message: "Server could not upload image", error: error.message });
  }
}

router.get("/", getPosts);
router.get("/:postId", getPostById);
router.put(
  "/:postId",
  protectAdmin,
  imageFileUpload,
  resolveImageUrl,
  validatePostData,
  updatePost
);
router.delete("/:postId", protectAdmin, deletePost);

export default router;
