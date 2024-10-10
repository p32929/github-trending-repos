import { NextResponse } from 'next/server';
import axios from 'axios';
import cheerio from 'cheerio';

const languages = [
    'astro',
    'c',
    'c#',
    'c++',
    'clojure',
    'dart',
    'gdscript',
    'go',
    'haskell',
    'html',
    'java',
    'javascript',
    'kotlin',
    'lua',
    'nim',
    'nix',
    'ocaml',
    'php',
    'powershell',
    'python',
    'ruby',
    'rust',
    'scala',
    'svelte',
    'swift',
    'typescript',
    'vue',
    'zig',
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

    if (!forceFetch && lastFetchedDate === today && cachedRepos.length > 0) {
        console.log('Returning cached data for today');
        return NextResponse.json(cachedRepos);
    }

    console.time('Total Fetch Time');
    try {
        const results = await Promise.all(languages.map(fetchTrendingRepos));
        cachedRepos = results.flat();
        lastFetchedDate = today;

        console.timeEnd('Total Fetch Time');
        return NextResponse.json(cachedRepos);
    } catch (error) {
        console.timeEnd('Total Fetch Time');
        console.error('Error fetching trending repositories:', error);
        return NextResponse.json({ error: 'Failed to fetch trending repositories.' }, { status: 500 });
    }
}
