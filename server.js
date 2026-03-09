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

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || 'TU_API_KEY_AQUI';

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/anime', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  const filePath = req.file.path;

  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;

    // Modelo: cjwbw/animeganv2 - convierte fotos reales a anime
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'fd10e739b50f5b6d7e00eb4c424a86cc5a6a4f0c3b21ecce84d8d9c11f7b2b2',
        input: {
          image: base64Image,
        }
      })
    });

    const prediction = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(prediction.detail) || 'Error en Replicate');

    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Token ${REPLICATE_API_KEY}` }
      });
      result = await poll.json();
      attempts++;
    }

    if (result.status === 'failed') throw new Error('La IA no pudo procesar la imagen');
    if (attempts >= 30) throw new Error('Tiempo de espera agotado');

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
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
