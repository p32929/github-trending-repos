// server.js
const express = require('express');
const next = require('next');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const languages = [
    'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'gdscript', 'go',
    'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
    'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
    'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

const CACHE_FILE_PATH = './.data/scraped_data.json';

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    const io = require('socket.io')(httpServer, {
        transports: ['polling'], // Use polling as a fallback
    });

    io.on('connection', (socket) => {
        console.log('Client connected with socket id:', socket.id);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    // Express route for /api/trending
    server.get('/api/trending', async (req, res) => {
        const forceFetch = req.query.forceFetch === 'true';

        // Send immediate response to client
        res.json({ message: 'Scraping started or data returned from cache' });

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
            io.emit('progress', { message: 'Loaded data from cache' });
            io.emit('cachedData', { repos: cachedData.repos });
            io.emit('completed', { message: 'Data loaded from cache' });
        } else {
            // Start scraping process and emit events to all connected sockets

            try {
                let allRepos = [];
                for (const language of languages) {
                    // Emit progress update
                    console.log(`Fetching trending repositories for ${language}`);
                    io.emit('progress', { message: `Fetching trending repositories for ${language}` });

                    try {
                        // Fetch the trending repos for the language
                        const repos = await fetchTrendingRepos(language);

                        // Append to allRepos
                        allRepos = allRepos.concat(repos);

                        // Emit data for this language
                        io.emit('languageData', { language, repos });

                        // Emit success message
                        console.log(`Successfully fetched ${language}`);
                        io.emit('progress', { message: `Successfully fetched ${language}` });

                        // Update the client-side list live
                        io.emit('reposUpdate', { repos: allRepos });

                    } catch (error) {
                        console.error(`Error fetching for ${language}:`, error);
                        // Emit error message
                        io.emit('progress', { message: `Failed to fetch ${language}`, error });
                    }
                }

                // Save data to cache
                try {
                    await saveCacheToFile(allRepos, today);
                    console.log('Data saved to cache');
                } catch (error) {
                    console.error('Error saving to cache:', error);
                }

                // Emit completion event
                console.log('Scraping completed');
                io.emit('completed', { message: 'Scraping completed' });

            } catch (error) {
                console.error('Error scraping:', error);
                io.emit('error', { message: 'Error during scraping', error });
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
