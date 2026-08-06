import pool from "../utils/db.mjs";

const commentListQuery = `
  select
    comments.id,
    comments.post_id,
    comments.user_id,
    comments.comment_text,
    comments.created_at,
    coalesce(users.name, users.username) as author,
    users.profile_pic as avatar
  from comments
  inner join users on comments.user_id = users.id
`;

export async function getComments(req, res) {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    return res.status(404).json({ message: "Server could not find a requested post" });
  }

  try {
    const result = await pool.query(
      `${commentListQuery} where comments.post_id = $1 order by comments.created_at desc`,
      [postId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read comments because database connection",
    });
  }
}

export async function createComment(req, res) {
  const postId = Number(req.params.postId);
  const { comment_text } = req.body || {};

  if (!Number.isInteger(postId)) {
    return res.status(404).json({ message: "Server could not find a requested post" });
  }
  if (typeof comment_text !== "string" || !comment_text.trim()) {
    return res.status(400).json({ message: "Comment text is required" });
  }
  if (comment_text.length > 2000) {
    return res.status(400).json({ message: "Comment is too long" });
  }

  try {
    const inserted = await pool.query(
      `insert into comments (post_id, user_id, comment_text)
       values ($1, $2, $3)
       returning id, post_id, user_id, comment_text, created_at`,
      [postId, req.user.id, comment_text.trim()]
    );

    const result = await pool.query(
      `${commentListQuery} where comments.id = $1`,
      [inserted.rows[0].id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Server could not create comment because database connection",
    });
  }
}

export async function deleteComment(req, res) {
  const commentId = Number(req.params.commentId);
  if (!Number.isInteger(commentId)) {
    return res.status(404).json({ message: "Server could not find a requested comment" });
  }

  try {
    const existing = await pool.query(`select user_id from comments where id = $1`, [commentId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Server could not find a requested comment" });
    }

    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    await pool.query(`delete from comments where id = $1`, [commentId]);
    return res.status(200).json({ message: "Deleted comment successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not delete comment because database connection",
    });
  }
}
