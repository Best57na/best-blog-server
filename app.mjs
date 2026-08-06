import "dotenv/config";
import express from "express";
import cors from "cors";
import profileRouter from "./routes/profiles.mjs";
import postRouter from "./routes/posts.mjs";
import authRouter from "./routes/auth.mjs";
import categoryRouter from "./routes/categories.mjs";
import postUploadRouter from "./apps/postRoutes.mjs";

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json());

app.use("/profiles", profileRouter);
app.use("/posts", postRouter);
app.use("/posts", postUploadRouter);
app.use("/categories", categoryRouter);
app.use("/auth", authRouter);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
