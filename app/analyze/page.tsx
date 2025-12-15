'use client';

import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/app/components/theme-toggle';
import { StockImage } from '@/app/components/stock-image';

interface AnalysisResult {
    symbol: string;
    symbolInfo: { name: string; matchScore: number };
    data: { current: any; historicalDays: number; newsCount: number };
    analysis: {
        patterns: any[];
        supportLevels: number[];
        resistanceLevels: number[];
        recommendation: string;
        confidence: number;
        reasoning: string;
        riskFactors: string[];
    };
}

export default function AnalyzePage() {
     const [ticker, setTicker] = useState('');
     const [loading, setLoading] = useState(false);
     const [result, setResult] = useState<AnalysisResult | null>(null);
     const [error, setError] = useState('');
     const [suggestions, setSuggestions] = useState<any[]>([]);
     const [showSuggestions, setShowSuggestions] = useState(false);
     const searchContainerRef = useRef<HTMLDivElement>(null);

    // Fetch suggestions as user types
    const fetchSuggestions = async (query: string) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        try {
            const response = await fetch(`/api/search/ticker?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success) {
                setSuggestions(data.results);
                setShowSuggestions(true);
            }
        } catch (err) {
            console.error('Suggestion fetch error:', err);
        }
    };

    // Debouncing with useEffect
    const handleTickerChange = (value: string) => {
        setTicker(value);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    // Debounce effect
    useEffect(() => {
        if (ticker.length >= 2) {
            const timeoutId = setTimeout(() => {
                fetchSuggestions(ticker);
            }, 550);

            return () => clearTimeout(timeoutId);
        } else {
            setSuggestions([]);
        }
    }, [ticker]);

    // Handle clicks outside dropdown and escape key
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, []);

    const selectSuggestion = (symbol: string) => {
        setTicker(symbol);
        setShowSuggestions(false);
        setSuggestions([]);
        
        // Trigger background logo fetch
        fetch(`/api/logos/fetch?symbol=${encodeURIComponent(symbol)}`, {
            method: 'POST'
        }).catch(err => {
            console.debug(`Logo fetch initiated for ${symbol}`);
        });
    };

    const analyze = async () => {
        if (!ticker.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);
        setShowSuggestions(false);
        setSuggestions([]);

        try {
            const response = await fetch('/api/analyze/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: ticker.trim(), days: 90 })
            });

            if (!response.ok) {
                const errorData = await response.json();
                setError(errorData.error || 'Analysis failed');
                return;
            }

            const data = await response.json();

            if (data.success === false) {
                setError(data.error || 'Analysis failed');
                return;
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to analyze stock');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRecommendationColor = (rec: string) => {
        if (rec === 'BUY') return 'text-emerald-600 dark:text-emerald-400';
        if (rec === 'SELL') return 'text-red-600 dark:text-red-400';
        return 'text-amber-600 dark:text-amber-400';
    };

    const getRecommendationBg = (rec: string) => {
        if (rec === 'BUY') return 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700';
        if (rec === 'SELL') return 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700';
        return 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700';
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950">
            {/* Header Navigation */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 shadow-elevated-lg">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-elevated-lg flex items-center justify-center text-white text-lg font-bold">
                            📊
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Stock Analysis</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Insights</p>
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

            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Search Section */}
                <div className="mb-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Stock Analysis</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">Enter any stock ticker for comprehensive AI-powered analysis</p>

                        <div className="flex gap-3 relative" ref={searchContainerRef}>
                             <div className="flex-1 relative">
                                 <input
                                     type="text"
                                     value={ticker}
                                     onChange={(e) => handleTickerChange(e.target.value)}
                                     onKeyDown={(e) => {
                                         if (e.key === 'Enter') {
                                             setShowSuggestions(false);
                                             analyze();
                                         }
                                     }}
                                     onFocus={() => ticker.length >= 2 && setShowSuggestions(true)}
                                     placeholder="Enter stock symbol (e.g., TCS, RELIANCE, INFY)"
                                     className="w-full px-6 py-4 rounded-lg bg-slate-50 dark:bg-slate-900 border-1.5 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-lg focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800 transition-all shadow-sm"
                                     disabled={loading}
                                 />

                                {/* Autocomplete Dropdown */}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border-1.5 border-slate-200 dark:border-slate-700 rounded-lg shadow-elevated-2xl max-h-80 overflow-y-auto z-50">
                                        {suggestions.map((suggestion, idx) => (
                                             <button
                                                 key={idx}
                                                 onClick={() => selectSuggestion(suggestion.symbol)}
                                                 className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                                             >
                                                 <div className="flex items-center justify-between gap-4">
                                                     <div className="flex items-center gap-3 flex-1">
                                                         <StockImage symbol={suggestion.symbol} size="sm" />
                                                         <div className="flex-1">
                                                             <div className="font-semibold text-slate-900 dark:text-white">{suggestion.symbol}</div>
                                                             <div className="text-sm text-slate-500 dark:text-slate-400">{suggestion.name}</div>
                                                         </div>
                                                     </div>
                                                     <div className="text-xs font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-full border border-sky-200 dark:border-sky-700 flex-shrink-0">
                                                         {(suggestion.score * 100).toFixed(0)}% match
                                                     </div>
                                                 </div>
                                             </button>
                                         ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={analyze}
                                disabled={loading || !ticker.trim()}
                                className={`interactive-element px-8 py-4 rounded-lg font-bold shadow-elevated-lg hover:shadow-elevated-xl border-1.5 flex items-center gap-2 transition-all ${
                                    loading || !ticker.trim()
                                        ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-50 border-slate-300 dark:border-slate-600'
                                        : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white border-sky-500/50 dark:border-sky-600/50'
                                }`}
                            >
                                <span className="text-xl">{loading ? '⏳' : '🚀'}</span>
                                <span>{loading ? 'Analyzing...' : 'Analyze'}</span>
                            </button>
                        </div>

                        {loading && (
                            <div className="mt-4 flex items-center gap-3 text-sky-600 dark:text-sky-400">
                                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                                <span className="font-medium">Fetching data, analyzing patterns, and generating insights...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-1.5 border-red-200 dark:border-red-700 rounded-lg p-6 mb-8 shadow-elevated-lg animate-slide-in">
                        <p className="text-red-700 dark:text-red-300 text-lg font-semibold mb-2">❌ {error}</p>
                        {(error.includes('Insufficient') || error.includes('not available')) && (
                            <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                                💡 Try popular stocks: TCS, RELIANCE, INFY, HDFCBANK, ICICIBANK
                            </p>
                        )}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Header Info */}
                         <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-4">
                                     <StockImage symbol={result.symbol} size="lg" />
                                     <div>
                                         <h2 className="text-4xl font-bold text-slate-900 dark:text-white">{result.symbol}</h2>
                                         <p className="text-slate-500 dark:text-slate-400 mt-1">{result.symbolInfo.name}</p>
                                     </div>
                                 </div>
                                <div className="text-right bg-sky-50 dark:bg-sky-900/20 rounded-lg px-4 py-3 border-1.5 border-sky-200 dark:border-sky-700 shadow-sm">
                                    <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide">Data Points</div>
                                    <div className="text-2xl font-bold text-sky-600 dark:text-sky-300">{result.data.historicalDays} days</div>
                                </div>
                            </div>
                        </div>

                        {/* Recommendation */}
                        <div className={`rounded-xl p-8 shadow-elevated-lg border-1.5 ${getRecommendationBg(result.analysis.recommendation)}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">AI Recommendation</div>
                                    <div className={`text-5xl font-bold ${getRecommendationColor(result.analysis.recommendation)}`}>
                                        {result.analysis.recommendation}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">Confidence</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                        {(result.analysis.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">{result.analysis.reasoning}</p>
                        </div>

                        {/* Patterns */}
                        {result.analysis.patterns.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <span>📊</span> Detected Patterns
                                </h3>
                                <div className="space-y-3">
                                    {result.analysis.patterns.map((pattern, idx) => (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border-1.5 border-slate-200 dark:border-slate-600 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-sky-600 dark:text-sky-400">{pattern.type}</span>
                                                <span className="text-sm font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-full">
                                                    {(pattern.confidence * 100).toFixed(0)}% confidence
                                                </span>
                                            </div>
                                            <p className="text-slate-700 dark:text-slate-300">{pattern.description}</p>
                                            {pattern.target && (
                                                <div className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                    Target: ₹{pattern.target} | Stop Loss: ₹{pattern.stopLoss}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Support & Resistance */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all">
                                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-6 flex items-center gap-2">
                                    <span>📈</span> Support Levels
                                </h3>
                                <div className="space-y-3">
                                    {result.analysis.supportLevels.map((level, idx) => (
                                        <div key={idx} className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border-1.5 border-emerald-200 dark:border-emerald-700 text-center shadow-sm">
                                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{level?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border-1.5 border-slate-200 dark:border-slate-700 shadow-elevated-lg hover:shadow-elevated-xl transition-all">
                                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-6 flex items-center gap-2">
                                    <span>📉</span> Resistance Levels
                                </h3>
                                <div className="space-y-3">
                                    {result.analysis.resistanceLevels.map((level, idx) => (
                                        <div key={idx} className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-1.5 border-red-200 dark:border-red-700 text-center shadow-sm">
                                            <span className="text-2xl font-bold text-red-600 dark:text-red-400">₹{level?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Risk Factors */}
                        {result.analysis.riskFactors.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border-1.5 border-amber-200 dark:border-amber-700 rounded-xl p-6 shadow-elevated-lg">
                                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
                                    <span>⚠️</span> Risk Factors
                                </h3>
                                <ul className="space-y-3">
                                    {result.analysis.riskFactors.map((risk, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                                            <span className="text-slate-700 dark:text-slate-300">{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Info Footer */}
                {!result && !error && !loading && (
                    <div className="mt-12 text-center">
                        <div className="text-6xl mb-4">📊</div>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">
                            Start by entering a stock ticker to get AI-powered analysis
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-12 text-center text-slate-500 dark:text-slate-400 text-sm border-t-1.5 border-slate-200 dark:border-slate-800 pt-6">
                    <p>✨ Powered by AI • 📊 Real-time NSE Data • 🧠 Pattern Recognition</p>
                </div>
            </div>
        </div>
    );
}
