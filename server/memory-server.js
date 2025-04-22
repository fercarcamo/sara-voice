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
      snippet TEXT NOT NULL,
      category TEXT,
      source TEXT,
      language TEXT
    )
  `);

  // Create conversation logs table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      conversationId TEXT
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
    const { role, snippet, category, source, language } = req.body;
    if (!role || !snippet || !source) return res.status(400).send('Missing role, snippet, or source');
    const ts = Date.now();
    const result = await db.run(
      `INSERT INTO memory (timestamp, role, snippet, category, source, language)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ts, role, snippet, category, source, language
    );
    res.json({ id: result.lastID, timestamp: ts, role, snippet, category, source, language });
  });

  // GET all logs
  app.get('/api/logs', async (req, res) => {
    const logs = await db.all('SELECT * FROM logs ORDER BY timestamp DESC');
    res.json(logs);
  });

  // POST a new log entry
  app.post('/api/logs', async (req, res) => {
    const { role, content, conversationId } = req.body;
    if (!role || !content) return res.status(400).send('Missing role or content');
    const ts = Date.now();
    const result = await db.run(
      'INSERT INTO logs (timestamp, role, content, conversationId) VALUES (?, ?, ?, ?)',
      ts, role, content, conversationId ?? null
    );
    res.json({ id: result.lastID, timestamp: ts, role, content, conversationId });
  });

  // DELETE one log
  app.delete('/api/logs/:id', async (req, res) => {
    await db.run('DELETE FROM logs WHERE id = ?', req.params.id);
    res.sendStatus(204);
  });

  // DELETE all logs
  app.delete('/api/logs', async (req, res) => {
    await db.run('DELETE FROM logs');
    res.sendStatus(204);
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
