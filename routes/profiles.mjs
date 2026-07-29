import { Router } from "express";

const router = Router();

const profiles = {
  john: {
    name: "john",
    age: 20,
  },
};

router.get("/", (req, res) => {
  res.status(200).json({ data: profiles.john });
});

export default router;
