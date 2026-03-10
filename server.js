const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Replicate = require("replicate");

const app = express();
const PORT = process.env.PORT || 3000;

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

if (!REPLICATE_API_KEY) {
  console.error("⚠️ Falta la variable REPLICATE_API_KEY");
}

const replicate = new Replicate({ auth: REPLICATE_API_KEY });

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

    // Usar el SDK oficial de Replicate
    const output = await replicate.run(
      "aaronaftab/mirage-ghibli",
      {
        input: {
          image: base64Image,
          prompt_strength: 0.8
        }
      }
    );

    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl) throw new Error("No se recibió imagen de la IA");

    res.json({ imageUrl: imageUrl.url ? imageUrl.url() : imageUrl });

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
