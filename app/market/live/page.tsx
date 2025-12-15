'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LiveMarketData } from '@/lib/scrapers/live-market-poller';
import { StockSearch } from '@/app/components/stock-search';
import { StockImage } from '@/app/components/stock-image';
import { ThemeToggle } from '@/app/components/theme-toggle';

const STOCK_UNIVERSE = [
  'TCS',
  'RELIANCE',
  'INFY',
  'HDFCBANK',
  'ICICIBANK',
  'SBIN',
  'HDFC',
  'BAJAJFINSV',
  'MARUTI',
  'WIPRO',
  'LT',
  'AXISBANK',
  'KOTAKBANK',
  'BHARTIARTL',
  'SUNPHARMA',
  'ASIANPAINT',
  'ONGC',
  'JSWSTEEL',
  'TATASTEEL',
  'POWERGRID',
  'HEROMOTOCO',
  'ULTRACEMCO',
  'ADANIPORTS',
  'APOLLOHOSP',
  'NESTLEIND',
  'DRREDDY',
  'LUPIN',
  'TECHM',
  'INDIGO',
  'ADANIGREEN',
];

const ITEMS_PER_PAGE = 10;

export default function LiveMarketPage() {
  const [liveData, setLiveData] = useState<Record<string, LiveMarketData | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [displayStocks, setDisplayStocks] = useState<string[]>(STOCK_UNIVERSE);

  // Paginate
  const totalPages = Math.ceil(displayStocks.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStocks = displayStocks.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Handle search selection
  const handleSelectStock = (symbol: string) => {
    setSelectedStock(symbol);
    setCurrentPage(1);
    setDisplayStocks([symbol]);
  };

  // Fetch live data for paginated stocks
  const fetchLiveData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/market/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: paginatedStocks }),
      });

      if (!response.ok) throw new Error('Failed to fetch live data');
      const data = await response.json();
      if (data.success) {
        setLiveData(data.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live data');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 10000);
    return () => clearInterval(interval);
  }, [currentPage, displayStocks]);

  // Clear selection button handler
  const handleClearSelection = () => {
    setSelectedStock(null);
    setDisplayStocks(STOCK_UNIVERSE);
    setCurrentPage(1);
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const getChangeBg = (change: number) => {
    if (change > 0) return 'bg-emerald-50 dark:bg-emerald-900/20';
    if (change < 0) return 'bg-red-50 dark:bg-red-900/20';
    return 'bg-slate-50 dark:bg-slate-900/20';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 shadow-elevated-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-elevated-lg flex items-center justify-center text-white text-lg font-bold">
              📈
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Live Market</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time NSE & BSE Data
                {lastUpdated && (
                  <>
                    <br />
                    Last updated: <time dateTime={lastUpdated.toISOString()}>{lastUpdated.toLocaleTimeString('en-IN')}</time>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href="/"
              className="interactive-element px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium border-1.5 border-slate-300 dark:border-slate-700 shadow-elevated hover:shadow-elevated-lg"
            >
              ← Back
            </a>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Search and Controls */}
         <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
           <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
             <div className="flex-1 w-full">
               <StockSearch
                 onSelect={handleSelectStock}
                 placeholder="Search stocks by symbol or name (e.g., TCS, RELIANCE, INFY)..."
                 disabled={loading}
                 isSearching={loading}
               />
             </div>
             {selectedStock && (
               <button
                 onClick={handleClearSelection}
                 className="px-4 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-all"
               >
                 Clear Filter
               </button>
             )}
             <button
               onClick={fetchLiveData}
               disabled={loading}
               className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-elevated hover:shadow-elevated-lg transition-all"
             >
               {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
             </button>
           </div>

           {lastUpdated && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                Last updated: {lastUpdated.toLocaleString('en-IN')}
              </div>
            )}
         </div>

        {/* Results info */}
         <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
           Showing {Math.min(startIdx + 1, displayStocks.length)} to{' '}
           {Math.min(startIdx + ITEMS_PER_PAGE, displayStocks.length)} of {displayStocks.length} stocks
           {selectedStock && ` (filtered for "${selectedStock}")`}
         </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-1.5 border-red-200 dark:border-red-700 rounded-lg p-4 mb-6 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Stocks Table */}
        {loading && !Object.keys(liveData).length ? (
          <div className="text-center py-12">
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">Fetching live market data...</p>
          </div>
        ) : displayStocks.length === 0 ? (
           <div className="text-center py-12">
             <div className="text-4xl mb-4">🔍</div>
             <p className="text-slate-600 dark:text-slate-400">
               No stocks found for "{selectedStock}"
             </p>
             <button
               onClick={handleClearSelection}
               className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
             >
               Clear Filter
             </button>
           </div>
         ) : (
          <>
            <div className="overflow-x-auto rounded-xl border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b-1.5 border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      Price
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      Change
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      %
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      High
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      Low
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white">
                      Volume
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold text-slate-900 dark:text-white">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-1.5 divide-slate-200 dark:divide-slate-700">
                  {paginatedStocks.map((stock) => {
                    const data = liveData[stock];
                    if (!data) {
                      return (
                        <tr
                           key={stock}
                           className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                         >
                           <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                             <StockImage symbol={stock} size="sm" showLabel />
                           </td>
                          <td colSpan={6} className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                            Loading...
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Link
                              href={`/market/ticker/${stock}`}
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                         key={stock}
                         className={`hover:shadow-md transition-colors ${getChangeBg(data?.change || 0)}`}
                       >
                         <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                           <StockImage symbol={stock} size="sm" showLabel />
                         </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-white">
                          ₹{(data?.price || 0).toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold ${getChangeColor(data?.change || 0)}`}>
                          {(data?.change || 0) > 0 ? '▲' : (data?.change || 0) < 0 ? '▼' : '•'}{' '}
                          {(data?.change || 0) > 0 ? '+' : ''}
                          {(data?.change || 0).toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 text-right font-semibold ${getChangeColor(data?.change || 0)}`}>
                          {(data?.changePercent || 0) > 0 ? '+' : ''}
                          {(data?.changePercent || 0).toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          ₹{(data?.dayHigh || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          ₹{(data?.dayLow || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">
                          {((data?.volume || 0) / 1000000).toFixed(2)}M
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            href={`/market/ticker/${stock}`}
                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg font-medium transition-all ${
                        currentPage === page
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
