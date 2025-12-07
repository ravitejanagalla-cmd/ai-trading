'use client';

import { useState } from 'react';

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

    // Debounce suggestions
    const handleTickerChange = (value: string) => {
        setTicker(value);
        setShowSuggestions(false);

        // Debounce
        const timeoutId = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);

        return () => clearTimeout(timeoutId);
    };

    const selectSuggestion = (symbol: string) => {
        setTicker(symbol);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const analyze = async () => {
        if (!ticker.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const response = await fetch('/api/analyze/stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker: ticker.trim(), days: 90 })
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.error || 'Analysis failed');
                return;
            }

            setResult(data);
        } catch (err) {
            setError('Failed to analyze stock');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRecommendationColor = (rec: string) => {
        if (rec === 'BUY') return 'text-green-600';
        if (rec === 'SELL') return 'text-red-600';
        return 'text-yellow-600';
    };

    const getRecommendationBg = (rec: string) => {
        if (rec === 'BUY') return 'bg-green-100 border-green-300';
        if (rec === 'SELL') return 'bg-red-100 border-red-300';
        return 'bg-yellow-100 border-yellow-300';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-2">🔍 Stock Analysis AI</h1>
                    <p className="text-gray-400">Enter any stock ticker for comprehensive AI-powered analysis</p>
                </div>

                {/* Search Box */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
                    <div className="flex gap-4 relative">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => handleTickerChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && analyze()}
                                onFocus={() => ticker.length >= 2 && setShowSuggestions(true)}
                                placeholder="Enter stock symbol (e.g., TCS, Reliance, HDFC)"
                                className="w-full px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                disabled={loading}
                            />

                            {/* Autocomplete Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-purple-500/50 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50">
                                    {suggestions.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => selectSuggestion(suggestion.symbol)}
                                            className="w-full px-6 py-3 text-left hover:bg-purple-600/30 transition-colors border-b border-gray-800 last:border-b-0"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold text-white">{suggestion.symbol}</div>
                                                    <div className="text-sm text-gray-400">{suggestion.name}</div>
                                                </div>
                                                <div className="text-xs text-purple-400">
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
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                        >
                            {loading ? '🔄 Analyzing...' : '🚀 Analyze'}
                        </button>
                    </div>
                    {loading && (
                        <div className="mt-4 flex items-center gap-3 text-purple-300">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                            <span>Fetching data, analyzing patterns, and generating insights...</span>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-8">
                        <p className="text-red-200">❌ {error}</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-bold">{result.symbol}</h2>
                                    <p className="text-gray-400">{result.symbolInfo.name}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-400">Data Points</div>
                                    <div className="text-2xl font-bold">{result.data.historicalDays} days</div>
                                </div>
                            </div>
                        </div>

                        {/* Recommendation */}
                        <div className={`${getRecommendationBg(result.analysis.recommendation)} rounded-2xl p-6 border-2`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-sm text-gray-700 mb-1">AI Recommendation</div>
                                    <div className={`text-4xl font-bold ${getRecommendationColor(result.analysis.recommendation)}`}>
                                        {result.analysis.recommendation}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-700 mb-1">Confidence</div>
                                    <div className="text-2xl font-bold text-gray-800">
                                        {(result.analysis.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-800 leading-relaxed">{result.analysis.reasoning}</p>
                        </div>

                        {/* Patterns */}
                        {result.analysis.patterns.length > 0 && (
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                                <h3 className="text-xl font-bold mb-4">📊 Detected Patterns</h3>
                                <div className="space-y-3">
                                    {result.analysis.patterns.map((pattern, idx) => (
                                        <div key={idx} className="bg-white/5 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-purple-300">{pattern.type}</span>
                                                <span className="text-sm text-gray-400">
                                                    {(pattern.confidence * 100).toFixed(0)}% confidence
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-300">{pattern.description}</p>
                                            {pattern.target && (
                                                <div className="mt-2 text-sm text-green-400">
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
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                                <h3 className="text-xl font-bold mb-4 text-green-400">📈 Support Levels</h3>
                                <div className="space-y-2">
                                    {result.analysis.supportLevels.map((level, idx) => (
                                        <div key={idx} className="bg-green-500/20 rounded-lg p-3 text-center">
                                            <span className="text-2xl font-bold">₹{level?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                                <h3 className="text-xl font-bold mb-4 text-red-400">📉 Resistance Levels</h3>
                                <div className="space-y-2">
                                    {result.analysis.resistanceLevels.map((level, idx) => (
                                        <div key={idx} className="bg-red-500/20 rounded-lg p-3 text-center">
                                            <span className="text-2xl font-bold">₹{level?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Risk Factors */}
                        {result.analysis.riskFactors.length > 0 && (
                            <div className="bg-orange-500/20 border border-orange-500/50 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-4 text-orange-300">⚠️ Risk Factors</h3>
                                <ul className="space-y-2">
                                    {result.analysis.riskFactors.map((risk, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-orange-400">•</span>
                                            <span className="text-gray-300">{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Info Footer */}
                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>✨ Powered by AI • 📊 Real-time NSE Data • 🧠 Pattern Recognition</p>
                </div>
            </div>
        </div>
    );
}
