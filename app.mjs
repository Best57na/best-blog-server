import "dotenv/config";
import express from "express";
import cors from "cors";
import profileRouter from "./routes/profiles.mjs";
import postRouter from "./routes/posts.mjs";
import assignmentRouter from "./routes/assignments.mjs";
import authRouter from "./routes/auth.mjs";
import postUploadRouter from "./apps/postRoutes.mjs";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/profiles", profileRouter);
app.use("/posts", postRouter);
app.use("/posts", postUploadRouter);
app.use("/assignments", assignmentRouter);
app.use("/auth", authRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
