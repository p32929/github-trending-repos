import { NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';

// List of programming languages to scrape
const languages = [
    'dart',
    'go',
    'haskell',
    'java',
    'javascript',
    'lua',
    'nim',
    'nix',
    'python',
    'ruby',
    'rust',
    'swift',
    'typescript',
    'zig',
];

// Define the Repo interface
interface Repo {
    language: string;
    repoUrl: string;
    stars: number;
    starsToday: number | null;
    forks: number | null;
}

// Function to fetch and scrape trending repositories for a given language
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

            // Updated selector for forks
            const forks = parseInt(
                repoElement
                    .find('a:has(svg[aria-label="fork"])')
                    .text()
                    .trim()
                    .replace(',', '') || '0', // Fallback to 0 if not found
                10
            ) || null; // Set to null if forks are not available

            // Extract stars today (may be null if not present)
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

export async function GET() {
    console.time('Total Fetch Time'); // Start timing
    try {
        // Fetch data concurrently for all languages
        const results = await Promise.all(languages.map(fetchTrendingRepos));

        // Flatten the results and return the array of Repo objects
        const repos: Repo[] = results.flat();

        console.timeEnd('Total Fetch Time'); // End timing and log the duration
        return NextResponse.json(repos);
    } catch (error) {
        console.timeEnd('Total Fetch Time'); // End timing in case of error
        console.error('Error fetching trending repositories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch trending repositories.' },
            { status: 500 }
        );
    }
}
