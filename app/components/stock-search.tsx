'use client';

import { useState, useEffect, useRef } from 'react';
import { StockImage } from './stock-image';

interface StockSearchProps {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isSearching?: boolean;
  autoFocus?: boolean;
}

interface SearchResult {
  symbol: string;
  name?: string;
  score?: number;
}

export function StockSearch({
  onSelect,
  placeholder = 'Search stocks...',
  disabled = false,
  isSearching = false,
  autoFocus = false,
}: StockSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch suggestions
  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setIsFetching(true);
      const response = await fetch(
        `/api/search/ticker?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.results)) {
        setSuggestions(data.results);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSuggestions([]);
    } finally {
      setIsFetching(false);
    }
  };

  // Debounce effect
  useEffect(() => {
    if (query.length >= 2) {
      const timeoutId = setTimeout(() => {
        fetchSuggestions(query);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [query]);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
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

  const handleSelect = (symbol: string) => {
    setQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Trigger background logo fetch if available
    fetch(`/api/logos/fetch?symbol=${encodeURIComponent(symbol)}`, {
      method: 'POST'
    }).catch(err => {
      console.debug(`Logo fetch initiated for ${symbol}`);
    });
    
    onSelect(symbol);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (query.trim()) {
        handleSelect(query.trim().toUpperCase());
      }
    }
  };

  return (
    <div className="relative w-full" ref={searchContainerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled || isSearching}
          autoFocus={autoFocus}
          className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border-1.5 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 transition-all disabled:opacity-50"
        />
        {(isFetching || isSearching) && (
          <div className="absolute right-3 top-3">
            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border-1.5 border-slate-200 dark:border-slate-700 rounded-lg shadow-elevated-2xl max-h-80 overflow-y-auto z-50">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(suggestion.symbol)}
              className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <StockImage symbol={suggestion.symbol} size="sm" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {suggestion.symbol}
                    </div>
                    {suggestion.name && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {suggestion.name}
                      </div>
                    )}
                  </div>
                </div>
                {suggestion.score && (
                  <div className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full flex-shrink-0">
                    {(suggestion.score * 100).toFixed(0)}% match
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
