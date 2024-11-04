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

import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

interface Repo {
  language: string;
  repoUrl: string;
  stars: number;
  starsToday: number | null;
  forks: number | null;
}

const TrendingReposTable = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortField, setSortField] = useState<keyof Repo>('starsToday');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<{ [language: string]: 'pending' | 'success' | 'failed' }>({});

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    const sessionId = uuidv4();

    const socket = io('/', { query: { sessionId } });

    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      axios.get(`/api/trending?sessionId=${sessionId}`)
        .then(response => {
          console.log('Scraping started');
        })
        .catch(error => {
          console.error('Failed to start scraping:', error);
          toast.error('Failed to start scraping');
          setLoading(false);
        });
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
      }

      const failMatch = data.message.match(/Failed to fetch (.+)/);
      if (failMatch) {
        const language = failMatch[1];
        setProgress(prevProgress => ({
          ...prevProgress,
          [language]: 'failed',
        }));
      }
    });

    socket.on('languageData', (data) => {
      console.log('Received data for language:', data.language);
      setRepos(prevRepos => [...prevRepos, ...data.repos]);
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
              setRepos([]);
              fetchRepos();
            }}>
              Force Fetch
            </Button>
          </div>
        </div>
        <Separator orientation='horizontal' />
      </div>
      {loading ? (
        <div>
          <p>{progressMessage}</p>
          <ul>
            {Object.keys(progress).map(language => (
              <li key={language}>
                {language}: {progress[language]}
              </li>
            ))}
          </ul>
          <div className="space-y-4">
            {[...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <Table className="text-left">
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
