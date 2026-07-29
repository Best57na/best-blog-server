import pool from "../utils/db.mjs";

const postDetailQuery = `
  select
    posts.id,
    posts.image,
    categories.name as category,
    posts.title,
    posts.description,
    posts.date,
    posts.content,
    statuses.status,
    posts.likes_count
  from posts
  inner join categories on posts.category_id = categories.id
  inner join statuses on posts.status_id = statuses.id
`;

export async function getPosts(req, res) {
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 6;
  const { category, keyword } = req.query;
  const offset = (page - 1) * limit;

  const values = [];
  const conditions = [];

  if (category) {
    values.push(category);
    conditions.push(`categories.name ilike $${values.length}`);
  }

  if (keyword) {
    values.push(`%${keyword}%`);
    conditions.push(
      `(posts.title ilike $${values.length} or posts.description ilike $${values.length} or posts.content ilike $${values.length})`
    );
  }

  const whereClause = conditions.length
    ? `where ${conditions.join(" and ")}`
    : "";

  try {
    const countResult = await pool.query(
      `select count(*)
       from posts
       inner join categories on posts.category_id = categories.id
       ${whereClause}`,
      values
    );

    const totalPosts = Number(countResult.rows[0].count);
    const totalPages = Math.max(Math.ceil(totalPosts / limit), 1);

    const postsResult = await pool.query(
      `${postDetailQuery}
       ${whereClause}
       order by posts.date desc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      totalPosts,
      totalPages,
      currentPage: page,
      limit,
      posts: postsResult.rows,
      nextPage: page < totalPages ? page + 1 : null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
}

export async function getPostById(req, res) {
  const postId = Number(req.params.postId);

  if (!Number.isInteger(postId)) {
    return res.status(404).json({
      message: "Server could not find a requested post",
    });
  }

  try {
    const result = await pool.query(`${postDetailQuery} where posts.id = $1`, [
      postId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
}

export async function createPost(req, res) {
  const { title, image, category_id, description, content, status_id } =
    req.body;

  try {
    await pool.query(
      `insert into posts (title, image, category_id, description, content, status_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [title, image, category_id, description, content, status_id]
    );

    return res.status(201).json({ message: "Created post sucessfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not create post because database connection",
    });
  }
}

export async function updatePost(req, res) {
  const postId = Number(req.params.postId);
  const { title, image, category_id, description, content, status_id } =
    req.body;

  if (!Number.isInteger(postId)) {
    return res.status(404).json({
      message: "Server could not find a requested post to update",
    });
  }

  try {
    const result = await pool.query(
      `update posts
       set title = $1,
           image = $2,
           category_id = $3,
           description = $4,
           content = $5,
           status_id = $6
       where id = $7`,
      [title, image, category_id, description, content, status_id, postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to update",
      });
    }

    return res.status(200).json({ message: "Updated post sucessfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not update post because database connection",
    });
  }
}

export async function deletePost(req, res) {
  const postId = Number(req.params.postId);

  if (!Number.isInteger(postId)) {
    return res.status(404).json({
      message: "Server could not find a requested post to delete",
    });
  }

  try {
    const result = await pool.query(`delete from posts where id = $1`, [
      postId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to delete",
      });
    }

    return res.status(200).json({ message: "Deleted post successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not delete post because database connection",
    });
  }
}
