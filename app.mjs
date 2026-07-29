import "dotenv/config";
import express from "express";
import cors from "cors";
import profileRouter from "./routes/profiles.mjs";
import postRouter from "./routes/posts.mjs";
import assignmentRouter from "./routes/assignments.mjs";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/profiles", profileRouter);
app.use("/posts", postRouter);
app.use("/assignments", assignmentRouter);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
