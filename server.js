// server.js
const express = require('express');
const next = require('next');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const languages = [
  'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'gdscript', 'go',
  'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
  'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
  'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

const CACHE_FILE_PATH = './.data/scraped_data.json'

app.prepare().then(() => {
  const server = express();
  const httpServer = http.createServer(server);
  const io = socketIo(httpServer);

  // Store sockets by sessionId
  const sockets = {};

  io.on('connection', (socket) => {
    console.log('Client connected');

    // Get the session ID from the query parameters
    const sessionId = socket.handshake.query.sessionId;
    if (sessionId) {
      sockets[sessionId] = socket;
      socket.sessionId = sessionId;
      console.log(`Socket connected with sessionId: ${sessionId}`);
    } else {
      console.log('No sessionId provided');
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.sessionId}`);
      if (socket.sessionId) {
        delete sockets[socket.sessionId];
      }
    });
  });

  // Express route for /api/trending
  server.get('/api/trending', async (req, res) => {
    const sessionId = req.query.sessionId;
    const forceFetch = req.query.forceFetch === 'true';

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Send immediate response to client
    res.json({ message: 'Scraping started or data returned from cache' });

    const socket = sockets[sessionId];
    if (!socket) {
      console.log(`No socket connection for sessionId: ${sessionId}`);
      return;
    }

    // Now handle caching
    const today = new Date().toISOString().split('T')[0];
    let cachedData = null;

    if (!forceFetch) {
      try {
        const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
        const parsedData = JSON.parse(data);
        if (parsedData.lastFetchedDate === today) {
          cachedData = parsedData;
        }
      } catch (error) {
        console.error('Error reading cache file:', error);
      }
    }

    if (cachedData) {
      console.log('Returning cached data');
      socket.emit('progress', { message: 'Loaded data from cache' });
      socket.emit('cachedData', { repos: cachedData.repos });
      socket.emit('completed', { message: 'Data loaded from cache' });
      socket.disconnect();
    } else {
      // Start scraping process and emit events to the socket with this sessionId

      // Now start scraping
      try {
        let allRepos = [];
        for (const [index, language] of languages.entries()) {
          // Emit progress update
          socket.emit('progress', { message: `Fetching trending repositories for ${language}` });

          try {
            // Fetch the trending repos for the language
            const repos = await fetchTrendingRepos(language);

            // Append to allRepos
            allRepos = allRepos.concat(repos);

            // Emit data for this language
            socket.emit('languageData', { language, repos });

            // Emit success message
            socket.emit('progress', { message: `Successfully fetched ${language}` });

            // Update the client-side list live
            socket.emit('reposUpdate', { repos: allRepos });

          } catch (error) {
            console.error(`Error fetching for ${language}:`, error);
            // Emit error message
            socket.emit('progress', { message: `Failed to fetch ${language}`, error });
          }
        }

        // Once done, save data to cache
        try {
          await saveCacheToFile(allRepos, today);
          console.log('Data saved to cache');
        } catch (error) {
          console.error('Error saving to cache:', error);
        }

        // Once done, emit completion event
        socket.emit('completed', { message: 'Scraping completed' });

        // Optionally, disconnect the socket
        socket.disconnect();

      } catch (error) {
        console.error('Error scraping:', error);
        socket.emit('error', { message: 'Error during scraping', error });
        socket.disconnect();
      }
    }
  });

  // Use Next.js request handler for other routes
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const port = process.env.PORT || 3000;
  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});

// The fetchTrendingRepos function
async function fetchTrendingRepos(language) {
  const url = `https://github.com/trending/${language}?since=daily`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const $ = cheerio.load(html);
    const repositories = [];

    $('.Box-row').each((_, element) => {
      const repoElement = $(element);

      const repoPath = repoElement.find('h2 a').attr('href')?.trim() || '';
      const repoUrl = `https://github.com${repoPath}`;

      const stars = parseInt(
        repoElement
          .find('a[href$="/stargazers"]')
          .first()
          .text()
          .trim()
          .replace(',', ''),
        10
      );

      const forks =
        parseInt(
          repoElement
            .find('a:has(svg[aria-label="fork"])')
            .text()
            .trim()
            .replace(',', '') || '0',
          10
        ) || null;

      const starsTodayMatch = repoElement
        .find('.f6.color-fg-muted.mt-2')
        .text()
        .match(/(\d+) stars today/);
      const starsToday = starsTodayMatch ? parseInt(starsTodayMatch[1], 10) : null;

      repositories.push({
        language,
        repoUrl,
        stars,
        starsToday,
        forks,
      });
    });

    return repositories;
  } catch (error) {
    console.error(`Error fetching trending repositories for ${language}:`, error);
    return [];
  }
}

// Function to save data to a file
async function saveCacheToFile(repos, date) {
  const data = JSON.stringify({ repos, lastFetchedDate: date });
  await fs.writeFile(CACHE_FILE_PATH, data, 'utf-8');
}
