//this script do the following:
// - Start your memory server
// - Start the Python static server for your frontend
// - Open index.html, sara-logs.html, and longterm-memory.html in Chrome


// server/start-all.js
// start-all.js (located in: Sara/)
// This file starts both the memory server and the Python HTML server

// start-all.js (located in: Sara/)
// This file starts both the memory server and the Python HTML server

import { exec } from 'child_process';
import path from 'path';
import open from 'open';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Start the memory server from its own directory
const memoryServer = exec('node memory-server.js', { cwd: __dirname });
memoryServer.stdout.on('data', data => console.log(`[MemoryServer] ${data}`));
memoryServer.stderr.on('data', data => console.error(`[MemoryServer Error] ${data}`));
memoryServer.stdout.on('data', data => console.log(`[MemoryServer] ${data}`));
memoryServer.stderr.on('data', data => console.error(`[MemoryServer Error] ${data}`));

// 2. Start the Python HTML server from root folder (Sara/)
const htmlServer = exec('python3 -m http.server 8000', { cwd: path.resolve(__dirname, '..') });
htmlServer.stdout.on('data', data => console.log(`[HTMLServer] ${data}`));
htmlServer.stderr.on('data', data => console.error(`[HTMLServer Error] ${data}`));

// 3. Open all necessary tabs in Chrome
const chromeFlags = { app: true }; // or use { wait: true } if needed
const baseUrl = 'http://localhost:8000';
const pages = ['index.html', 'sara-logs.html', 'longterm-memory.html'];
pages.forEach(page => open(`${baseUrl}/${page}`, { app: { name: 'google chrome' } }));
