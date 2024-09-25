'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast, Toaster } from 'sonner'; // Sonner toast for error notifications
import { Skeleton } from '@/components/ui/skeleton';

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
  const [sortField, setSortField] = useState<keyof Repo>('language');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch data from the API
  useEffect(() => {
    const fetchRepos = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/trending');
        setRepos(response.data);
      } catch (error) {
        console.error('Failed to fetch trending repositories:', error);
        toast.error('Failed to load trending repositories');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  // Sorting logic for the table
  const sortedRepos = [...repos].sort((a, b) => {
    if (a[sortField] === null || b[sortField] === null) return 0; // Handle null values
    if (a[sortField] < b[sortField]) return sortOrder === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Toggle sorting order or change the sorting field
  const handleSort = (field: keyof Repo) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-4">
      <Toaster position="top-right" /> {/* Sonner Toaster for toast notifications */}
      <h1 className="text-xl font-bold mb-4 text-center">Trending Repositories</h1>

      {loading ? (
        <div className="space-y-4">
          {/* Display skeletons when loading */}
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table className="text-center">
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="link" onClick={() => handleSort('language')}>
                  Language {sortField === 'language' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="link" onClick={() => handleSort('repoUrl')}>
                  Repo URL {sortField === 'repoUrl' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="link" onClick={() => handleSort('stars')}>
                  Stars {sortField === 'stars' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="link" onClick={() => handleSort('starsToday')}>
                  Stars Today {sortField === 'starsToday' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="link" onClick={() => handleSort('forks')}>
                  Forks {sortField === 'forks' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRepos.map((repo, index) => (
              <TableRow key={index}>
                <TableCell className="text-center">{repo.language}</TableCell>
                <TableCell className="text-center">
                  <a href={repo.repoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                    {repo.repoUrl}
                  </a>
                </TableCell>
                <TableCell className="text-center">{repo.stars}</TableCell>
                <TableCell className="text-center">{repo.starsToday ?? 'N/A'}</TableCell>
                <TableCell className="text-center">{repo.forks ?? 'N/A'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default TrendingReposTable;
