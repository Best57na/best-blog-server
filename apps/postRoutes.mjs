import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const supabaseStorage = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const postRouter = Router();

const multerUpload = multer({ storage: multer.memoryStorage() });
const imageFileUpload = multerUpload.fields([
  { name: "imageFile", maxCount: 1 },
]);

postRouter.post("/", [imageFileUpload, protectAdmin], async (req, res) => {
  try {
    const newPost = req.body;
    const file = req.files.imageFile[0];

    const bucketName = "my-personal-blog";
    const filePath = `posts/${Date.now()}_${file.originalname}`;

    const { data, error } = await supabaseStorage.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabaseStorage.storage.from(bucketName).getPublicUrl(data.path);

    const query = `INSERT INTO posts (title, image, category_id, description, content, status_id)
      VALUES ($1, $2, $3, $4, $5, $6)`;
    const values = [
      newPost.title,
      publicUrl,
      parseInt(newPost.category_id),
      newPost.description,
      newPost.content,
      parseInt(newPost.status_id),
    ];
    await connectionPool.query(query, values);

    return res.status(201).json({ message: "Created post successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server could not create post",
      error: err.message,
    });
  }
});

export default postRouter;
