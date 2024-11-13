'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast, Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GithubIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Repo {
  language: string;
  repoUrl: string;
  stars: number;
  starsToday: number | null;
  forks: number | null;
}

const languages = [
  'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'dockerfile', 'elixir', 'gdscript', 'go',
  'haskell', 'html', 'java', 'julia', 'javascript', 'kotlin', 'lua', 'nim',
  'nix', 'ocaml', 'php', 'powershell', 'python', 'ruby', 'rust',
  'scala', 'svelte', 'swift', 'typescript', 'vue', 'zig',
];

const TrendingReposTable = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [progressVisible, setProgressVisible] = useState<boolean>(true);
  const [sortField, setSortField] = useState<keyof Repo>('starsToday');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [progress, setProgress] = useState<{ [language: string]: 'pending' | 'success' | 'failed' }>({});
  const [completedLanguages, setCompletedLanguages] = useState<number>(0);

  useEffect(() => {
    const socket: Socket = io('/');

    socket.on('connect', () => console.log('Connected to Socket.IO server'));
    socket.on('progress', (data) => handleProgressUpdate(data.message));
    socket.on('languageData', (data) => {
      const { language, repos } = data;
      setRepos((prevRepos) => [...prevRepos, ...repos]);
      setProgress((prev) => ({ ...prev, [language]: 'success' }));
    });
    socket.on('completed', () => {
      setLoading(false);
      finalizeProgress();
    });
    socket.on('error', () => {
      toast.error('Error during scraping');
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    setRepos([]);
    setProgress({});
    setCompletedLanguages(0);

    languages.forEach((language) => {
      setProgress((prev) => ({ ...prev, [language]: 'pending' }));
    });

    axios.get(`/api/trending`).catch(() => {
      toast.error('Failed to start scraping');
      setLoading(false);
    });
  };

  const handleProgressUpdate = (message: string) => {
    if (message.includes('Fetching trending repositories for')) {
      const language = message.split('for ')[1];
      setProgress((prev) => ({ ...prev, [language]: 'pending' }));
    } else if (message.includes('Successfully fetched')) {
      const language = message.split('fetched ')[1];
      setProgress((prev) => ({ ...prev, [language]: 'success' }));
      setCompletedLanguages((prev) => prev + 1);
    } else if (message.includes('Failed to fetch')) {
      const language = message.split('fetch ')[1];
      setProgress((prev) => ({ ...prev, [language]: 'failed' }));
      setCompletedLanguages((prev) => prev + 1);
    }
  };

  const finalizeProgress = () => {
    setProgress((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([language, status]) => [
          language,
          status === 'pending' ? 'failed' : status,
        ])
      )
    );
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
    <div>
      <Toaster position="top-right" />
      <div className='flex flex-col pb-4'>
        <div className='flex flex-row p-4 justify-between items-center'>
          <h3 className="text-xl font-semibold">Github Trending Repos</h3>
          <a href='https://github.com/p32929' target='_blank'>
            <Button variant="outline" size="sm">
              <GithubIcon className='w-5 h-5 text-gray-200' />
            </Button>
          </a>
        </div>
        <Separator orientation='horizontal' />
      </div>

      {progressVisible && (
        <div className="mb-4 px-4">
          <div className="flex justify-between items-center">
            <p className="font-semibold">Progress:</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProgressVisible(false)}
            >
              Close
            </Button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1 my-2 relative overflow-hidden ">
            <div className="flex h-1 w-full">
              {languages.map((language, index) => (
                <div
                  key={index}
                  className={`h-1 ${getStatusColor(progress[language])}`}
                  style={{ width: `${100 / languages.length}%` }}
                ></div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {languages.map((language) => (
              <div key={language} className="flex items-center space-x-1">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(progress[language])}`}></span>
                <span className="text-sm">{language}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
