import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await connectionPool.query(
      "select id, name from categories order by name"
    );
    return res.status(200).json({ categories: rows });
  } catch (error) {
    return res.status(500).json({ message: "Server could not read categories" });
  }
});

router.post("/", protectAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }
  try {
    const { rows } = await connectionPool.query(
      "insert into categories (name) values ($1) returning id, name",
      [name.trim()]
    );
    return res.status(201).json({ category: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Server could not create category" });
  }
});

router.put("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  const { name } = req.body;
  if (!Number.isInteger(categoryId)) {
    return res.status(404).json({ message: "Category not found" });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ message: "Name is required" });
  }
  try {
    const { rows } = await connectionPool.query(
      "update categories set name = $1 where id = $2 returning id, name",
      [name.trim(), categoryId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.status(200).json({ category: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: "Server could not update category" });
  }
});

router.delete("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  if (!Number.isInteger(categoryId)) {
    return res.status(404).json({ message: "Category not found" });
  }
  try {
    const { rowCount } = await connectionPool.query(
      "delete from categories where id = $1",
      [categoryId]
    );
    if (!rowCount) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.status(200).json({ message: "Deleted category successfully" });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        message: "Cannot delete a category that still has posts assigned to it",
      });
    }
    return res.status(500).json({ message: "Server could not delete category" });
  }
});

export default router;
