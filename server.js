const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

if (!REPLICATE_API_KEY) {
  console.error("⚠️ Falta la variable REPLICATE_API_KEY");
}

/* asegurar carpeta uploads */

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* multer */

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* servir index */

app.use(express.static(__dirname));

/* endpoint principal */

app.post("/api/anime", upload.single("image"), async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: "No se recibió imagen" });
  }

  const filePath = req.file.path;

  try {

    const imageBuffer = fs.readFileSync(filePath);

    const base64Image =
      `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

    /* crear predicción */

    const response = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({

          version:
            "db21e45f6b5b3e0e33d8a1c8d3a4d5e7f6c8e1a3c2b4d6e8f9a0b1c2d3e4f5",

          input: {
            image: base64Image,
            prompt: "portrait anime style, studio ghibli, highly detailed"
          }

        })
      }
    );

    const prediction = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(prediction));
    }

    let result = prediction;
    let attempts = 0;

    /* polling */

    while (
      result.status !== "succeeded" &&
      result.status !== "failed" &&
      attempts < 40
    ) {

      await new Promise(r => setTimeout(r, 2000));

      const poll = await fetch(
        `https://api.replicate.com/v1/predictions/${result.id}`,
        {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_KEY}`
          }
        }
      );

      result = await poll.json();

      attempts++;

    }

    if (result.status === "failed") {
      throw new Error("La IA falló procesando la imagen");
    }

    const imageUrl = Array.isArray(result.output)
      ? result.output[0]
      : result.output;

    res.json({ imageUrl });

  } catch (err) {

    console.error("❌ ERROR IA:", err.message);

    res.status(500).json({
      error: "No se pudo generar la imagen anime"
    });

  } finally {

    fs.unlink(filePath, () => {});

  }

});

/* health check */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* iniciar servidor */

app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});