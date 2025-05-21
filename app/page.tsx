'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast, Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GithubIcon, RefreshCw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Repo {
  language: string;
  repoUrl: string;
  stars: number;
  starsToday: number | null;
  forks: number | null;
}

const languages = [
  'astro', 'c', 'c#', 'c++', 'clojure', 'dart', 'elixir', 'gdscript', 'go',
  'haskell', 'html', 'java', 'javascript', 'kotlin', 'lua', 'nim',
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const socket: Socket = io('/');

    socket.on('connect', () => console.log('Connected to Socket.IO server'));
    socket.on('progress', (data) => handleProgressUpdate(data.message));
    socket.on('languageData', (data) => {
      const { language, repos } = data;
      setRepos((prevRepos) => [...prevRepos, ...repos]);
      setProgress((prev) => ({ ...prev, [language]: 'success' }));
    });
    socket.on('completed', (data) => {
      setLoading(false);
      setLastUpdated(data.lastUpdated);
      finalizeProgress();
    });
    socket.on('error', () => {
      toast.error('Error during scraping');
      setLoading(false);
    });
    socket.on('cachedData', (data) => {
      setRepos(data.repos);
      setLastUpdated(data.lastUpdated);
      setLoading(false);
      setProgressVisible(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async (forceRefresh = false) => {
    setLoading(true);
    
    if (forceRefresh) {
      setRepos([]);
      setLastUpdated(null);
      setProgress({});
      setCompletedLanguages(0);
      setProgressVisible(true);

      languages.forEach((language) => {
        setProgress((prev) => ({ ...prev, [language]: 'pending' }));
      });
    }

    try {
      const response = await axios.get(`/api/trending${forceRefresh ? '?forceRefresh=true' : ''}`);
      
      if (response.data.status === 'cached') {
        toast.success('Using cached data from today', {
          position: "bottom-left",
          duration: 3000,
        });
        setLastUpdated(response.data.lastUpdated);
        if (!forceRefresh) {
          setProgressVisible(false);
        }
      } else if (response.data.status === 'in-progress') {
        toast.info('Data fetching already in progress');
      }
    } catch (error) {
      toast.error('Failed to start scraping');
      setLoading(false);
    }
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

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
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

  // Remove duplicate repositories (keeping the first occurrence)
  const uniqueRepos = sortedRepos.filter((repo, index, self) => 
    index === self.findIndex((r) => r.repoUrl === repo.repoUrl)
  );

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
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#161b22] border-b border-[#30363d] shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Github Trending Repos</h3>
            <p className="text-sm text-gray-400">Last updated: {formatDateTime(lastUpdated)}</p>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchRepos(true)}
              disabled={loading}
              className="bg-[#238636] hover:bg-[#2ea043] text-white border-0 transition-all"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <a href='https://github.com/p32929/github-trending-repos' target='_blank'>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d] transition-all"
              >
                <GithubIcon className='w-5 h-5' />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Progress panel */}
      {progressVisible && (
        <div className="container mx-auto px-4 my-4">
          <div className="bg-[#161b22] rounded-md border border-[#30363d] p-4 shadow-md">
            <div className="flex justify-between items-center mb-3">
              <p className="font-bold text-white">Progress</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProgressVisible(false)}
                className="bg-[#21262d] hover:bg-[#30363d] text-white border border-[#30363d]"
              >
                Close
              </Button>
            </div>
            <div className="w-full bg-[#21262d] rounded-full h-2 mb-4">
              <div className="flex h-2 w-full">
                {languages.map((language, index) => (
                  <div
                    key={index}
                    className={`h-2 ${getStatusColor(progress[language])} transition-all duration-300`}
                    style={{ width: `${100 / languages.length}%` }}
                  ></div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {languages.map((language) => (
                <div key={language} className="flex items-center gap-2 bg-[#21262d] px-2 py-1 rounded-md">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(progress[language])}`}></span>
                  <span className="text-xs text-white">{language}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {repos.length > 0 && (
        <div className="container mx-auto px-4 pb-8">
          <div className="flex justify-between items-center py-3">
            <p className="text-sm text-gray-400">
              Showing {uniqueRepos.length} unique repositories {repos.length !== uniqueRepos.length && 
              `(${repos.length - uniqueRepos.length} duplicates removed)`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#161b22] text-left text-sm font-medium">
                <tr>
                  <th 
                    onClick={() => handleSort('language')} 
                    className="py-3 px-4 cursor-pointer hover:bg-[#30363d] border-b border-[#30363d]"
                  >
                    <div className="flex items-center">
                      <span>Language</span>
                      {sortField === 'language' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('repoUrl')} 
                    className="py-3 px-4 cursor-pointer hover:bg-[#30363d] border-b border-[#30363d] w-full"
                  >
                    <div className="flex items-center">
                      <span>Repository</span>
                      {sortField === 'repoUrl' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('stars')} 
                    className="py-3 px-4 cursor-pointer hover:bg-[#30363d] border-b border-[#30363d] text-right whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end">
                      <span>Stars</span>
                      {sortField === 'stars' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('starsToday')} 
                    className="py-3 px-4 cursor-pointer hover:bg-[#30363d] border-b border-[#30363d] text-right whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end">
                      <span>Today</span>
                      {sortField === 'starsToday' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('forks')} 
                    className="py-3 px-4 cursor-pointer hover:bg-[#30363d] border-b border-[#30363d] text-right whitespace-nowrap"
                  >
                    <div className="flex items-center justify-end">
                      <span>Forks</span>
                      {sortField === 'forks' && (
                        <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {uniqueRepos.map((repo, index) => (
                  <tr key={index} className="hover:bg-[#161b22] transition-colors">
                    <td className="py-3 px-4 border-b border-[#30363d]">
                      <span className="inline-block px-2 py-1 bg-[#21262d] text-xs font-medium rounded-full">
                        {repo.language === '' ? 'Overall' : repo.language}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-b border-[#30363d] max-w-[400px] truncate">
                      <a 
                        href={repo.repoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[#58a6ff] hover:underline"
                      >
                        {repo.repoUrl.replace('https://github.com/', '')}
                      </a>
                    </td>
                    <td className="py-3 px-4 border-b border-[#30363d] text-right font-mono text-yellow-300">
                      {repo.stars.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 border-b border-[#30363d] text-right font-mono text-green-400">
                      +{(repo.starsToday ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 border-b border-[#30363d] text-right font-mono text-purple-300">
                      {(repo.forks ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendingReposTable;
