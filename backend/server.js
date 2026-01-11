import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 10000;

const buildPath = path.join(__dirname, "..", "frontend", "build");
app.use(express.static(buildPath));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

app.listen(port, () => {});
