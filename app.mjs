import express from "express";

const app = express();
const port = 4000;

const profiles = {
  john: {
    name: "john",
    age: 20,
  },
};

app.get("/profiles", (req, res) => {
  res.status(200).json({ data: profiles.john });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});