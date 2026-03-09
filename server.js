const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app    = express();
const PORT   = process.env.PORT || 3000;
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }
});

const HF_API_KEY = process.env.HF_API_KEY || 'TU_API_KEY_AQUI';

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/anime', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  const filePath = req.file.path;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Usar img2img con modelo anime de Hugging Face
    const response = await fetch(
      'https://api-inference.huggingface.co/models/strangerzonehf/Flux-Anime2Cartoon-LoRA',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `anime style portrait of a person, highly detailed, vibrant colors, studio ghibli`,
          parameters: {
            image: `data:${mimeType};base64,${base64Image}`,
            strength: 0.75,
            num_inference_steps: 20,
          }
        })
      }
    );

    if (response.status === 503) {
      return res.status(503).json({ error: 'El modelo está cargando, intenta en 30 segundos' });
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Error: ' + err);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Result = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:image/png;base64,${base64Result}`;

    res.json({ imageUrl });

  } catch (err) {
    console.error('[ANIME ERROR]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`AnimeAI corriendo en http://localhost:${PORT}`);
});
