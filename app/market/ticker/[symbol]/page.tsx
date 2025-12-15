'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/app/components/theme-toggle';
import { StockImage } from '@/app/components/stock-image';
import StockPriceChart from '@/app/components/StockPriceChart';

interface TickerData {
  symbol: string;
  live: any;
  fundamental: any;
  technical: any;
  news: any[];
  lastUpdated: string;
}

export default function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = rawSymbol.toUpperCase();
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'fundamentals' | 'technical' | 'news'>(
    'overview'
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/market/ticker?symbol=${symbol}`);

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to fetch ticker data');
          return;
        }

        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to fetch ticker data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ticker data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading ticker data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 shadow-elevated-lg">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <StockImage symbol={symbol} size="lg" />
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{symbol}</h1>
            </div>
            <Link
              href="/market/live"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
            >
              ← Back to Market
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12">
          <div className="bg-red-50 dark:bg-red-900/20 border-1.5 border-red-200 dark:border-red-700 rounded-lg p-6 text-red-700 dark:text-red-300">
            <p className="font-semibold mb-2">❌ Error Loading Ticker</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const live = data.live;
  const fundamental = data.fundamental;
  const technical = data.technical;
  const news = data.news;

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (!num) return 'N/A';
    if (num >= 1000000000) return (num / 1000000000).toFixed(decimals) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(decimals) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(decimals) + 'K';
    return num.toFixed(decimals);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 shadow-elevated-lg">
         <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
           <div className="flex-1 flex items-center gap-4">
             <StockImage symbol={symbol} size="lg" />
             <div>
               <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{symbol}</h1>
               <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                 {fundamental && <span>{fundamental.companyName}</span>}
                 {data && (
                   <span className="flex items-center gap-1">
                     •
                     <time dateTime={data.lastUpdated}>
                       {new Date(data.lastUpdated).toLocaleString('en-IN')}
                     </time>
                   </span>
                 )}
               </div>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <ThemeToggle />
             <Link
               href="/market/live"
               className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium border-1.5 border-slate-300 dark:border-slate-700"
             >
               ← Back
             </Link>
           </div>
         </div>
       </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Live Price Section */}
        {live && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl p-8 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Current Price
                </div>
                <div className="text-4xl font-bold text-slate-900 dark:text-white">
                  ₹{(live?.price || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Change
                </div>
                <div className={`text-3xl font-bold ${getChangeColor(live?.change || 0)}`}>
                  {(live?.change || 0) > 0 ? '▲' : (live?.change || 0) < 0 ? '▼' : '•'}{' '}
                  {(live?.change || 0) > 0 ? '+' : ''}
                  {(live?.change || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Change %
                </div>
                <div className={`text-3xl font-bold ${getChangeColor(live?.change || 0)}`}>
                  {(live?.changePercent || 0) > 0 ? '+' : ''}
                  {(live?.changePercent || 0).toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Open
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  ₹{(live?.open || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  High
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  ₹{(live?.dayHigh || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Low
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  ₹{(live?.dayLow || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Volume
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {formatNumber(live?.volume || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
          {['overview', 'fundamentals', 'technical', 'news'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'fundamentals' && '🏢 Fundamentals'}
              {tab === 'technical' && '📈 Technical'}
              {tab === 'news' && '📰 News'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {fundamental && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Company Info</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Sector
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {fundamental.sector || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Industry
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {fundamental.industry || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Market Cap
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{formatNumber(fundamental.marketCap)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Employees
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {fundamental.employees ? formatNumber(fundamental.employees) : 'N/A'}
                    </p>
                  </div>
                </div>
                {fundamental.description && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      About
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-3">
                      {fundamental.description}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Fundamentals Tab */}
        {activeTab === 'fundamentals' && fundamental && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Valuation Metrics
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    P/E Ratio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.peRatio ? (fundamental.peRatio).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    P/B Ratio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.pbRatio ? (fundamental.pbRatio).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    P/S Ratio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.priceToSales ? (fundamental.priceToSales).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    EV/EBITDA
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.evToEbitda ? (fundamental.evToEbitda).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    EPS
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    ₹{fundamental?.eps ? (fundamental.eps).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Dividend Yield
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.dividendYield ? ((fundamental.dividendYield) * 100).toFixed(2) : 'N/A'}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Profitability & Returns
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    ROE
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.roe ? ((fundamental.roe) * 100).toFixed(2) : 'N/A'}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    ROIC
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.roic ? ((fundamental.roic) * 100).toFixed(2) : 'N/A'}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Net Margin
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.netMargin ? ((fundamental.netMargin) * 100).toFixed(2) : 'N/A'}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Operating Margin
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.operatingMargin ? ((fundamental.operatingMargin) * 100).toFixed(2) : 'N/A'}%
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Debt to Equity
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.debtToEquity ? (fundamental.debtToEquity).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Beta
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.beta ? (fundamental.beta).toFixed(2) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Liquidity & Efficiency
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Current Ratio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.currentRatio ? (fundamental.currentRatio).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Quick Ratio
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.quickRatio ? (fundamental.quickRatio).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Asset Turnover
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {fundamental?.assetTurnover ? (fundamental.assetTurnover).toFixed(2) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Technical Tab */}
        {activeTab === 'technical' && technical && (
          <div className="space-y-6">
            <StockPriceChart symbol={symbol} />
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Technical Analysis</h2>
              <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Trend
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {technical.indicators?.trend || 'Unknown'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Current trend direction based on moving averages
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Momentum
                </p>
                <p
                  className={`text-3xl font-bold mb-2 ${getChangeColor(
                    technical?.indicators?.momentum || 0
                  )}`}
                >
                  {(technical?.indicators?.momentum || 0).toFixed(2)}%
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  5-day momentum change
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Volatility
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {(technical?.indicators?.volatility || 0).toFixed(2)}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  10-day standard deviation
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                  Data Points
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  {technical.historicalDays}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Days of historical data
                </p>
              </div>
              {technical?.indicators?.ma5 && (
                <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                    5-Day MA
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    ₹{(technical.indicators?.ma5 || 0).toFixed(2)}
                  </p>
                </div>
              )}
              {technical?.indicators?.ma20 && (
                <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase mb-2">
                    20-Day MA
                  </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    ₹{(technical.indicators?.ma20 || 0).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
            </div>
            </div>
            )}

            {/* News Tab */}
        {activeTab === 'news' && (
          <div className="space-y-4">
            {news && news.length > 0 ? (
              news.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          {item.source || 'Unknown'}
                        </span>
                        <span className="text-slate-500 dark:text-slate-500">{item.date}</span>
                        {item.category && (
                          <span className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2 py-1 rounded-full">
                            {item.category}
                          </span>
                        )}
                        {item.sentiment && (
                          <span
                            className={`px-2 py-1 rounded-full font-medium ${
                              item.sentiment === 'bullish'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : item.sentiment === 'bearish'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {item.sentiment}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 mb-3">{item.summary}</p>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium text-sm"
                    >
                      Read More →
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">No news available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
