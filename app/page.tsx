'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
// @ts-ignore
import { toast, Toaster } from 'sonner'; // Sonner toast for error notifications
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

// Define the Repo interface matching the API response
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

  // Retry logic
  const fetchWithRetry = async (url: string, retries = 2, delay = 1000): Promise<any> => {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, retries - 1, delay);
      } else {
        throw error;
      }
    }
  };

  // Fetch data from the API
  const fetchRepos = async (forceFetch = false) => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`/api/trending?forceFetch=${forceFetch}`);
      setRepos(data);
    } catch (error) {
      console.error('Failed to fetch trending repositories:', error);
      toast.error('Failed to load trending repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  // Sorting logic for the table
  const sortedRepos = [...repos].sort((a, b) => {
    const aValue = a[sortField] ?? 0;
    const bValue = b[sortField] ?? 0;

    if (sortField === 'language' || sortField === 'repoUrl') {
      // Alphabetical sorting
      return sortOrder === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    } else {
      // Numerical sorting
      // @ts-ignore
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  // Toggle sorting order or change the sorting field
  const handleSort = (field: keyof Repo) => {
    if (sortField === field) {
      // If sorting the same field, toggle between ascending and descending
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If a new field is selected, start with descending order
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="">
      <Toaster position="top-right" /> {/* Sonner Toaster for toast notifications */}

      <div className='flex flex-col pb-8'>
        <div className='flex flex-row justify-between p-4'>
          <h1 className="text-xl font-bold text-center">Trending Repositories</h1>
          <Button variant={'secondary'} size={'sm'} onClick={() => fetchRepos(true)}>
            Force Refresh
          </Button>
        </div>

        <Separator className="" />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
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
