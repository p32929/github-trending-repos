// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast, Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GithubIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client'; // Import Socket type

// Define the Repo interface matching the API response
interface Repo {
  language: string;
  repoUrl: string;
  stars: number;
  starsToday: number | null;
  forks: number | null;
}

const languages = [
  'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'gdscript', 'go',
  'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
  'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
  'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

const TrendingReposTable = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sortField, setSortField] = useState<keyof Repo>('starsToday');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<{ [language: string]: 'pending' | 'success' | 'failed' }>({});
  const [totalLanguages] = useState<number>(languages.length);
  const [completedLanguages, setCompletedLanguages] = useState<number>(0);

  useEffect(() => {
    // Create socket connection on component mount
    const socket: Socket = io('/');

    // Set up socket event handlers
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
    });

    socket.on('progress', (data) => {
      console.log('Progress:', data.message);
      setProgressMessage(data.message);

      const match = data.message.match(/Fetching trending repositories for (.+)/);
      if (match) {
        const language = match[1];
        setProgress(prevProgress => ({
          ...prevProgress,
          [language]: 'pending',
        }));
      }

      const successMatch = data.message.match(/Successfully fetched (.+)/);
      if (successMatch) {
        const language = successMatch[1];
        setProgress(prevProgress => ({
          ...prevProgress,
          [language]: 'success',
        }));
        setCompletedLanguages(prev => prev + 1);
      }

      const failMatch = data.message.match(/Failed to fetch (.+)/);
      if (failMatch) {
        const language = failMatch[1];
        setProgress(prevProgress => ({
          ...prevProgress,
          [language]: 'failed',
        }));
        setCompletedLanguages(prev => prev + 1);
      }

      if (data.message === 'Loaded data from cache') {
        setProgressMessage('Loaded data from cache');
      }
    });

    socket.on('languageData', (data) => {
      console.log('Received data for language:', data.language);
      setRepos(prevRepos => [...prevRepos, ...data.repos]);
    });

    socket.on('reposUpdate', (data) => {
      // Update the list live
      setRepos(data.repos);
    });

    socket.on('cachedData', (data) => {
      console.log('Received cached data');
      setRepos(data.repos);
      setLoading(false);
      socket.disconnect();
    });

    socket.on('completed', (data) => {
      console.log('Scraping completed');
      setProgressMessage(data.message);
      setLoading(false);
      socket.disconnect();
    });

    socket.on('error', (data) => {
      console.error('Error:', data.message);
      toast.error('Error during scraping');
      setLoading(false);
      socket.disconnect();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
    });

    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async (forceFetch = false) => {
    setLoading(true);
    setRepos([]); // Clear existing repos
    setProgress({});
    setProgressMessage('');
    setCompletedLanguages(0);

    axios.get(`/api/trending?forceFetch=${forceFetch}`)
      .then(response => {
        console.log('Scraping started or data returned from cache');
      })
      .catch(error => {
        console.error('Failed to start scraping:', error);
        toast.error('Failed to start scraping');
        setLoading(false);
      });
  };

  const sortedRepos = [...repos].sort((a, b) => {
    const aValue = a[sortField] ?? 0;
    const bValue = b[sortField] ?? 0;

    if (sortField === 'language' || sortField === 'repoUrl') {
      return sortOrder === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    } else {
      // @ts-ignore
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  const handleSort = (field: keyof Repo) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'pending':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className="">
      <Toaster position="top-right" />
      <div className='flex flex-col pb-4'>
        <div className='flex flex-row p-4 justify-between items-center'>
          <h3 className="text-xl font-semibold tracking-tight">
            Github Trending Repos
          </h3>
          <div className='flex flex-row items-center space-x-2'>
            <a href='https://github.com/p32929' target='_blank'>
              <Button variant={'outline'} size={'sm'}>
                <GithubIcon className='w-5 h-5 text-gray-200' />
              </Button>
            </a>
            <Button size={'sm'} variant={'secondary'} onClick={() => {
              fetchRepos(true);
            }}>
              Force Fetch
            </Button>
          </div>
        </div>
        <Separator orientation='horizontal' />
      </div>

      {/* Show progress bar and messages */}
      {loading && (
        <div className="mb-4 px-4">
          <p className="font-semibold mb-2">Progress:</p>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div
              className="bg-blue-600 h-4 rounded-full"
              style={{ width: `${(completedLanguages / totalLanguages) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm mb-2">{progressMessage}</p>
          <div className="flex flex-wrap gap-2">
            {languages.map(language => (
              <div key={language} className="flex items-center space-x-1">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(progress[language])}`}></span>
                <span className="text-sm">{language}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show skeleton only when loading and no repos yet */}
      {loading && repos.length === 0 && (
        <div className="space-y-4 px-4">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )}

      {/* Show the table */}
      {repos.length > 0 && (
        <Table className="text-left mt-4">
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('language')} className="cursor-pointer">
                Language {sortField === 'language' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </TableHead>
              <TableHead onClick={() => handleSort('repoUrl')} className="cursor-pointer">
                Repo URL {sortField === 'repoUrl' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </TableHead>
              <TableHead onClick={() => handleSort('stars')} className="cursor-pointer">
                Stars {sortField === 'stars' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </TableHead>
              <TableHead onClick={() => handleSort('starsToday')} className="cursor-pointer">
                Stars Today {sortField === 'starsToday' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </TableHead>
              <TableHead onClick={() => handleSort('forks')} className="cursor-pointer">
                Forks {sortField === 'forks' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRepos.map((repo, index) => (
              <TableRow key={index}>
                <TableCell className="text-left">{repo.language}</TableCell>
                <TableCell className="text-left">
                  <a href={repo.repoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                    {repo.repoUrl}
                  </a>
                </TableCell>
                <TableCell className="text-left">{repo.stars}</TableCell>
                <TableCell className="text-left">{repo.starsToday ?? 0}</TableCell>
                <TableCell className="text-left">{repo.forks ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default TrendingReposTable;
