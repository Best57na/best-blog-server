const fields = [
  { key: "title", label: "Title", type: "string" },
  { key: "image", label: "Image", type: "string" },
  { key: "category_id", label: "Category id", type: "number" },
  { key: "description", label: "Description", type: "string" },
  { key: "content", label: "Content", type: "string" },
  { key: "status_id", label: "Status id", type: "number" },
];

export function validatePostData(req, res, next) {
  const body = req.body;

  for (const { key, label, type } of fields) {
    if (body[key] === undefined || body[key] === "") {
      return res.status(400).json({ message: `${label} is required` });
    }

    if (type === "number") {
      if (Number.isNaN(Number(body[key]))) {
        return res.status(400).json({ message: `${label} must be a ${type}` });
      }
      body[key] = Number(body[key]);
    } else if (typeof body[key] !== type) {
      return res.status(400).json({ message: `${label} must be a ${type}` });
    }
  }

  next();
}
