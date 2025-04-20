// server/index.js
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';

async function main() {
  // Open or create SQLite database
  const db = await open({
    filename: './memory.db',
    driver: sqlite3.Database
  });

  // Create table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      role TEXT NOT NULL,
      snippet TEXT NOT NULL
    )
  `);

  // Set up Express app
  const app = express();
  app.use(cors({ origin: 'http://localhost:8000' }));
  app.use(express.json());

  // GET all memories
  app.get('/api/memory', async (req, res) => {
    const all = await db.all('SELECT * FROM memory ORDER BY timestamp DESC');
    res.json(all);
  });

  // POST a new memory
  app.post('/api/memory', async (req, res) => {
    const { role, snippet } = req.body;
    if (!role || !snippet) return res.status(400).send('Missing role or snippet');
    const ts = Date.now();
    const result = await db.run(
      'INSERT INTO memory (timestamp, role, snippet) VALUES (?, ?, ?)',
      ts, role, snippet
    );
    res.json({ id: result.lastID, timestamp: ts, role, snippet });
  });

  // DELETE a memory by ID
  app.delete('/api/memory/:id', async (req, res) => {
    await db.run('DELETE FROM memory WHERE id = ?', req.params.id);
    res.sendStatus(204);
  });

  // Start server
  app.listen(3001, () => {
    console.log('Sara memory server running at http://localhost:3001');
  });
}

main();