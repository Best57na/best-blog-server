import pool from "../utils/db.mjs";

export async function getLikeStatus(req, res) {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    return res.status(404).json({ message: "Server could not find a requested post" });
  }

  try {
    const existing = await pool.query(
      `select id from likes where post_id = $1 and user_id = $2`,
      [postId, req.user.id]
    );
    const postResult = await pool.query(`select likes_count from posts where id = $1`, [postId]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: "Server could not find a requested post" });
    }

    return res.status(200).json({
      liked: existing.rows.length > 0,
      likes_count: postResult.rows[0].likes_count,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read like status because database connection",
    });
  }
}

export async function toggleLike(req, res) {
  const postId = Number(req.params.postId);
  if (!Number.isInteger(postId)) {
    return res.status(404).json({ message: "Server could not find a requested post" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const postResult = await client.query(`select likes_count from posts where id = $1 for update`, [postId]);
    if (postResult.rows.length === 0) {
      await client.query("rollback");
      return res.status(404).json({ message: "Server could not find a requested post" });
    }

    const existing = await client.query(
      `select id from likes where post_id = $1 and user_id = $2`,
      [postId, req.user.id]
    );

    let liked;
    let likesCount;
    if (existing.rows.length > 0) {
      await client.query(`delete from likes where id = $1`, [existing.rows[0].id]);
      const updated = await client.query(
        `update posts set likes_count = greatest(likes_count - 1, 0) where id = $1 returning likes_count`,
        [postId]
      );
      liked = false;
      likesCount = updated.rows[0].likes_count;
    } else {
      await client.query(`insert into likes (post_id, user_id) values ($1, $2)`, [postId, req.user.id]);
      const updated = await client.query(
        `update posts set likes_count = likes_count + 1 where id = $1 returning likes_count`,
        [postId]
      );
      liked = true;
      likesCount = updated.rows[0].likes_count;
    }

    await client.query("commit");
    return res.status(200).json({ liked, likes_count: likesCount });
  } catch (error) {
    await client.query("rollback");
    return res.status(500).json({
      message: "Server could not update like because database connection",
    });
  } finally {
    client.release();
  }
}
