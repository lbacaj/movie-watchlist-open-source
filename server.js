require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const { AppError } = require('./errors');
const { initOpenAI, parseMovieInput, parseMovieFromImage } = require('./openai-service');
const { initTMDb, enrichMovieData, getPosterUrl, getProviderLogoUrl, getMovieVideos, getMovieCredits, getImageUrl, getProxyImageUrl } = require('./tmdb-service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' })); // Increased limit for image uploads
app.use(express.static('public'));

function transformItemForResponse(item) {
  if (!item) return null;

  return {
    ...item,
    genres: item.genres_json ? JSON.parse(item.genres_json) : [],
    providers: item.providers_json ? JSON.parse(item.providers_json) : [],
    poster_url: getPosterUrl(item.poster_path),
    provider_logos: item.providers_json
      ? JSON.parse(item.providers_json).map(p => ({
          ...p,
          logo_url: getProviderLogoUrl(p.logo_path)
        }))
      : [],
    personal_rating: item.personal_rating != null ? Number(item.personal_rating) : null,
    personal_notes: item.personal_notes || null
  };
}

function sendError(res, error, fallbackMessage = 'Something went wrong. Please try again.') {
  if (error instanceof AppError) {
    return res.status(error.statusCode || 400).json({
      error: error.message,
      ...(error.metadata ? { metadata: error.metadata } : {})
    });
  }

  console.error(error);
  return res.status(500).json({ error: fallbackMessage });
}

app.get('/tmdb/images/:size/:imageName', async (req, res) => {
  try {
    const { size, imageName } = req.params;

    const sanitizedSize = String(size || '').replace(/[^a-z0-9_]/gi, '');
    const sanitizedName = String(imageName || '').replace(/[^a-zA-Z0-9_.-]/g, '');

    if (!sanitizedSize || !sanitizedName) {
      return res.status(400).json({ error: 'Invalid image parameters' });
    }

    const remoteUrl = getImageUrl(`/${sanitizedName}`, sanitizedSize);
    if (!remoteUrl) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const response = await fetch(remoteUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image unavailable' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const cacheControl = response.headers.get('cache-control') || 'public, max-age=86400';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('TMDb image proxy error:', error);
    res.status(502).json({ error: 'Failed to load image' });
  }
});

app.post('/api/items/intake', async (req, res) => {
  try {
    const { input, image } = req.body;

    if ((!input || typeof input !== 'string' || input.trim().length === 0) && !image) {
      return res.status(400).json({ error: 'Please provide a movie title or upload an image' });
    }

    let parsedInput;
    if (image) {
      // Handle image input
      parsedInput = await parseMovieFromImage(image);
    } else {
      // Handle text input
      parsedInput = await parseMovieInput(input);
    }

    const enrichedData = await enrichMovieData(parsedInput);

    const existingItem = db.getItemByTmdbId(enrichedData.tmdb_id);
    if (existingItem) {
      return res.status(409).json({
        error: 'Already on your list',
        item: transformItemForResponse(existingItem)
      });
    }

    const newItem = db.createItem({
      ...enrichedData,
      raw_input: input || (image ? '[Image upload]' : parsedInput.title),
      status: 'to_watch'
    });

    res.json(transformItemForResponse(newItem));
  } catch (error) {
    console.error('Intake error:', error);
    sendError(res, error, 'We hit a snag while adding that movie. Please try again.');
  }
});

app.get('/api/items', (req, res) => {
  try {
    const { status } = req.query;

    if (status && !['to_watch', 'watched'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status parameter' });
    }

    if (status) {
      const items = db.getAllItems(status);
      res.json(items.map(transformItemForResponse));
    } else {
      const toWatch = db.getAllItems('to_watch');
      const watched = db.getAllItems('watched');
      res.json({
        to_watch: toWatch.map(transformItemForResponse),
        watched: watched.map(transformItemForResponse)
      });
    }
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/items/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['to_watch', 'watched'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedItem = db.updateItemStatus(parseInt(id), status);

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(transformItemForResponse(updatedItem));
  } catch (error) {
    console.error('Update status error:', error);
    sendError(res, error, 'Failed to update the movie status. Please try again.');
  }
});

app.patch('/api/items/:id/personal', (req, res) => {
  try {
    const { id } = req.params;
    const { personal_rating, personal_notes } = req.body;

    if (personal_rating != null) {
      const ratingNumber = Number(personal_rating);
      if (Number.isNaN(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
        throw new AppError('Personal rating must be between 0 and 5 stars.', 400);
      }
    }

    if (personal_notes != null && typeof personal_notes !== 'string') {
      throw new AppError('Personal notes must be text.', 400);
    }

    let ratingValue;
    if (personal_rating === undefined) {
      ratingValue = undefined;
    } else if (personal_rating === null) {
      ratingValue = null;
    } else {
      const numericRating = Number(personal_rating);
      if (Number.isNaN(numericRating)) {
        throw new AppError('Personal rating must be between 0 and 5 stars.', 400);
      }
      ratingValue = numericRating;
    }

    const updatedItem = db.updateItemPersonalDetails(
      parseInt(id, 10),
      ratingValue,
      personal_notes
    );

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(transformItemForResponse(updatedItem));
  } catch (error) {
    console.error('Update personal details error:', error);
    sendError(res, error, 'Failed to save your notes right now. Please try again.');
  }
});

app.delete('/api/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = db.deleteItem(parseInt(id));

    if (!success) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const item = db.getItemById(parseInt(id));

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(transformItemForResponse(item));
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/items/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const item = db.getItemById(parseInt(id));

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Fetch additional details from TMDb
    const [videos, credits] = await Promise.all([
      getMovieVideos(item.tmdb_id),
      getMovieCredits(item.tmdb_id)
    ]);

    const detailedItem = transformItemForResponse(item);

    // Add additional details
    detailedItem.videos = videos;
    detailedItem.credits = credits.map(person => ({
      ...person,
      profile_url: getProxyImageUrl(person.profile_path, 'w185')
    }));
    detailedItem.overview = item.overview;
    detailedItem.runtime = item.runtime;

    res.json(detailedItem);
  } catch (error) {
    console.error('Get item details error:', error);
    sendError(res, error, 'Failed to load the movie details. Please try again.');
  }
});

async function startServer() {
  try {
    initOpenAI(process.env.OPENAI_API_KEY);
    await initTMDb(process.env.TMDB_API_KEY, process.env.WATCH_REGION || 'US');
    db.initDatabase();

    app.listen(PORT, () => {
      console.log(`Movie Watchlist server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
