const express = require('express');
const next = require('next');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cheerio = require('cheerio');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const languages = [
    'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'gdscript', 'go',
    'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
    'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
    'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

app.prepare().then(() => {
    // Initialize the Express server
    const server = express();
    const httpServer = http.createServer(server);
    const io = socketIo(httpServer, {
        transports: ['polling'], // Use polling as a fallback
    });

    io.on('connection', (socket) => {
        console.log('Client connected with socket id:', socket.id);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    // Route for /api/trending with concurrent data fetching and no file-saving
    server.get('/api/trending', async (req, res) => {
        // Send immediate response to client
        res.json({ message: 'Scraping started' });

        try {
            console.log('Starting concurrent fetching for all languages');
            io.emit('progress', { message: 'Starting concurrent fetching for all languages' });

            // Map over languages and fetch data concurrently
            const fetchPromises = languages.map(async (language) => {
                try {
                    const repos = await fetchTrendingRepos(language);
                    io.emit('languageData', { language, repos });
                    io.emit('progress', { message: `Successfully fetched ${language}` });
                    return repos;
                } catch (error) {
                    console.error(`Error fetching for ${language}:`, error);
                    io.emit('progress', { message: `Failed to fetch ${language}`, error });
                    return [];
                }
            });

            // Wait for all promises to resolve
            const allReposArray = await Promise.all(fetchPromises);
            const allRepos = allReposArray.flat();

            // Emit completion event
            console.log('Scraping completed');
            io.emit('reposUpdate', { repos: allRepos });
            io.emit('completed', { message: 'Scraping completed' });

        } catch (error) {
            console.error('Error during scraping:', error);
            io.emit('error', { message: 'Error during scraping', error });
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
