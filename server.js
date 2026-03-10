const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

if (!REPLICATE_API_KEY) {
  console.error("⚠️ Falta la variable REPLICATE_API_KEY");
}

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.static(__dirname));

app.post("/api/anime", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió imagen" });

  const filePath = req.file.path;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

    // Endpoint específico del modelo (no necesita version ni model en el body)
    const response = await fetch("https://api.replicate.com/v1/models/aaronaftab/mirage-ghibli/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          image: base64Image,
        }
      })
    });

    const prediction = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(prediction));

    let result = prediction;
    let attempts = 0;

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < 40) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` }
      });
      result = await poll.json();
      attempts++;
    }

    if (result.status === "failed") throw new Error("La IA falló procesando la imagen");

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    res.json({ imageUrl });

  } catch (err) {
    console.error("❌ ERROR IA:", err.message);
    res.status(500).json({ error: "No se pudo generar la imagen anime" });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});
