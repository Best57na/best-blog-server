import express from "express";

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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});