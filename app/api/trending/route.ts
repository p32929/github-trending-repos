import { NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE_PATH = path.join(process.cwd(), './.data/scraped_data.json');

const languages = [
    'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'gdscript', 'go',
    'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
    'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
    'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

interface Repo {
    language: string;
    repoUrl: string;
    stars: number;
    starsToday: number | null;
    forks: number | null;
}

let cachedRepos: Repo[] = [];
let lastFetchedDate: string | null = null;
let isFetching = false; // Lock for fetch status
let fetchPromise: Promise<Repo[]> | null = null; // Promise to hold the ongoing fetch

// Function to save data to a file
async function saveCacheToFile(repos: Repo[], date: string) {
    const data = JSON.stringify({ repos, lastFetchedDate: date });
    await fs.writeFile(CACHE_FILE_PATH, data, 'utf-8');
}

// Function to load cache from file
async function loadCacheFromFile() {
    try {
        const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
        const parsedData = JSON.parse(data);
        return parsedData;
    } catch (error) {
        console.error('Error reading cache file:', error);
        return null;
    }
}

async function fetchTrendingRepos(language: string): Promise<Repo[]> {
    const url = `https://github.com/trending/${language}?since=daily`;

    try {
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
            },
        });

        const $ = cheerio.load(html);
        const repositories: Repo[] = [];

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

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export async function GET(request: Request) {
    const today = getTodayDateString();
    const { searchParams } = new URL(request.url);
    const forceFetch = searchParams.get('forceFetch') === 'true';

    // Attempt to load cached data from file if no forceFetch is requested
    if (!forceFetch && !lastFetchedDate) {
        const cachedData = await loadCacheFromFile();
        if (cachedData) {
            cachedRepos = cachedData.repos;
            lastFetchedDate = cachedData.lastFetchedDate;
        }
    }

    // Return cached data if we already fetched today and no force fetch is required
    if (!forceFetch && lastFetchedDate === today && cachedRepos.length > 0) {
        console.log('Returning cached data for today');
        return NextResponse.json(cachedRepos);
    }

    // If a fetch is already in progress, wait for it to finish
    if (isFetching && fetchPromise) {
        console.log('Waiting for ongoing fetch to complete');
        await fetchPromise;
        return NextResponse.json(cachedRepos);
    }

    console.time('Total Fetch Time');

    // Start fetching and set the lock
    isFetching = true;
    fetchPromise = Promise.all(languages.map(fetchTrendingRepos))
        .then((results) => {
            cachedRepos = results.flat();
            lastFetchedDate = today;
            return cachedRepos;
        })
        .then(async (repos) => {
            await saveCacheToFile(repos, today); // Save fetched data to file
            console.timeEnd('Total Fetch Time');
            return repos;
        })
        .catch((error) => {
            console.error('Error fetching trending repositories:', error);
            return [];
        })
        .finally(() => {
            isFetching = false; // Release the lock
            fetchPromise = null; // Reset the promise
        });

    // Wait for the fetch to finish and return the result
    const finalRepos = await fetchPromise;

    // If there was an error and no repositories were fetched
    if (finalRepos.length === 0) {
        return NextResponse.json({ error: 'Failed to fetch trending repositories.' }, { status: 500 });
    }

    return NextResponse.json(finalRepos);
}
