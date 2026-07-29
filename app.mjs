import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./utils/db.mjs";

const app = express();
const port = process.env.PORT || 4000;

const profiles = {
  john: {
    name: "john",
    age: 20,
  },
};

app.use(cors());
app.use(express.json());

app.get("/profiles", (req, res) => {
  res.status(200).json({ data: profiles.john });
});

app.post("/assignments", async (req, res) => {
  const { title, image, category_id, description, content, status_id } =
    req.body;

  if (
    !title ||
    !image ||
    !category_id ||
    !description ||
    !content ||
    !status_id
  ) {
    return res.status(400).json({
      message:
        "Server could not create post because there are missing data from client",
    });
  }

  try {
    await pool.query(
      `insert into assignments (title, image, category_id, description, content, status_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [title, image, category_id, description, content, status_id]
    );

    return res.status(201).json({ message: "Created post sucessfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Server could not create post because database connection",
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});