const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'watchlist.sqlite'));

function initDatabase() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_input TEXT,
      title TEXT NOT NULL,
      year INTEGER,
      description TEXT,
      tmdb_id INTEGER UNIQUE,
      poster_path TEXT,
      release_date TEXT,
      genres_json TEXT,
      vote_average REAL,
      vote_count INTEGER,
      providers_json TEXT,
      overview TEXT,
      runtime INTEGER,
      personal_rating REAL,
      personal_notes TEXT,
      status TEXT NOT NULL DEFAULT 'to_watch' CHECK (status IN ('to_watch', 'watched')),
      watched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  db.exec(createTableSQL);

  // Add columns if they don't exist (for existing databases)
  try {
    db.exec('ALTER TABLE items ADD COLUMN overview TEXT');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE items ADD COLUMN runtime INTEGER');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE items ADD COLUMN personal_rating REAL');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE items ADD COLUMN personal_notes TEXT');
  } catch (e) {}

  const indexSQL = `
    CREATE INDEX IF NOT EXISTS idx_status ON items (status);
    CREATE INDEX IF NOT EXISTS idx_tmdb_id ON items (tmdb_id);
  `;

  db.exec(indexSQL);

  console.log('Database initialized successfully');
}

function createItem(itemData) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO items (
      raw_input, title, year, description, tmdb_id, poster_path,
      release_date, genres_json, vote_average, vote_count,
      providers_json, overview, runtime, personal_rating, personal_notes,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    itemData.raw_input,
    itemData.title,
    itemData.year || null,
    itemData.description || null,
    itemData.tmdb_id,
    itemData.poster_path || null,
    itemData.release_date || null,
    itemData.genres_json || null,
    itemData.vote_average || null,
    itemData.vote_count || null,
    itemData.providers_json || null,
    itemData.overview || null,
    itemData.runtime || null,
    itemData.personal_rating || null,
    itemData.personal_notes || null,
    itemData.status || 'to_watch',
    now,
    now
  );

  return getItemById(info.lastInsertRowid);
}

function getItemById(id) {
  const stmt = db.prepare('SELECT * FROM items WHERE id = ?');
  return stmt.get(id);
}

function getItemByTmdbId(tmdbId) {
  const stmt = db.prepare('SELECT * FROM items WHERE tmdb_id = ?');
  return stmt.get(tmdbId);
}

function getAllItems(status = null) {
  let query = 'SELECT * FROM items';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  return params.length > 0 ? stmt.all(...params) : stmt.all();
}

function updateItemStatus(id, status) {
  const now = new Date().toISOString();
  const watched_at = status === 'watched' ? now : null;

  const stmt = db.prepare(`
    UPDATE items
    SET status = ?, watched_at = ?, updated_at = ?
    WHERE id = ?
  `);

  const info = stmt.run(status, watched_at, now, id);

  if (info.changes === 0) {
    return null;
  }

  return getItemById(id);
}

function updateItemPersonalDetails(id, personalRating, personalNotes) {
  const now = new Date().toISOString();

  const existing = getItemById(id);
  if (!existing) {
    return null;
  }

  let ratingValue;
  if (typeof personalRating === 'number' && !Number.isNaN(personalRating)) {
    ratingValue = personalRating;
  } else if (personalRating === null) {
    ratingValue = null;
  } else {
    ratingValue = existing.personal_rating || null;
  }

  let notesValue;
  if (typeof personalNotes === 'string') {
    notesValue = personalNotes;
  } else if (personalNotes === null) {
    notesValue = null;
  } else {
    notesValue = existing.personal_notes || null;
  }

  const stmt = db.prepare(`
    UPDATE items
    SET personal_rating = ?, personal_notes = ?, updated_at = ?
    WHERE id = ?
  `);

  const info = stmt.run(ratingValue, notesValue, now, id);

  if (info.changes === 0) {
    return null;
  }

  return getItemById(id);
}

function deleteItem(id) {
  const stmt = db.prepare('DELETE FROM items WHERE id = ?');
  const info = stmt.run(id);
  return info.changes > 0;
}

module.exports = {
  initDatabase,
  createItem,
  getItemById,
  getItemByTmdbId,
  getAllItems,
  updateItemStatus,
  updateItemPersonalDetails,
  deleteItem
};
