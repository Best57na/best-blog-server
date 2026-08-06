import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import connectionPool from "../utils/db.mjs";
import protectUser from "../middlewares/protectUser.mjs";

const supabaseStorage = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = Router();

const multerUpload = multer({ storage: multer.memoryStorage() });
const avatarUpload = multerUpload.fields([{ name: "avatarFile", maxCount: 1 }]);

router.put("/me", [avatarUpload, protectUser], async (req, res) => {
  const { name, username } = req.body;
  if (!name || !name.trim() || !username || !username.trim()) {
    return res.status(400).json({ error: "Name and username are required" });
  }

  try {
    const usernameCheck = await connectionPool.query(
      "select id from users where username = $1 and id != $2",
      [username.trim(), req.user.id]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }

    let profilePicUrl = null;
    const file = req.files?.avatarFile?.[0];
    if (file) {
      const bucketName = "my-personal-blog";
      const filePath = `avatars/${req.user.id}_${Date.now()}_${file.originalname}`;
      const { data, error } = await supabaseStorage.storage
        .from(bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (error) throw error;
      profilePicUrl = supabaseStorage.storage.from(bucketName).getPublicUrl(data.path)
        .data.publicUrl;
    }

    const query = profilePicUrl
      ? `update users set name = $1, username = $2, profile_pic = $3 where id = $4 returning *`
      : `update users set name = $1, username = $2 where id = $3 returning *`;
    const values = profilePicUrl
      ? [name.trim(), username.trim(), profilePicUrl, req.user.id]
      : [name.trim(), username.trim(), req.user.id];

    const { rows } = await connectionPool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ error: "User profile not found" });
    }

    return res.status(200).json({
      id: req.user.id,
      email: req.user.email,
      username: rows[0].username,
      name: rows[0].name,
      role: rows[0].role,
      profilePic: rows[0].profile_pic,
    });
  } catch (error) {
    return res.status(500).json({ error: "Server could not update profile" });
  }
});

export default router;
