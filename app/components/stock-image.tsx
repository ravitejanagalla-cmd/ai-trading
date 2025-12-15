'use client';

import { useState, useEffect } from 'react';
import { getPlaceholderImage } from '@/lib/utils/stock-images';

interface StockImageProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

const sizes = {
  sm: 32,
  md: 48,
  lg: 64,
};

export function StockImage({
  symbol,
  size = 'md',
  className = '',
  showLabel = false,
}: StockImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(() => {
    // Try SVG first (placeholder), then PNG (real logo)
    return `/logos/stocks/${symbol.toLowerCase()}.svg`;
  });
  const [hasError, setHasError] = useState(false);

  const sizePixels = sizes[size];
  const symbolUpper = symbol.toUpperCase();
  const placeholderSrc = getPlaceholderImage(symbol);

  const handleImageError = () => {
    // Use placeholder SVG on error
    setImageSrc(placeholderSrc);
    setHasError(true);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-shrink-0 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600"
        style={{ width: sizePixels, height: sizePixels }}
      >
        <img
          src={imageSrc}
          alt={`${symbol} logo`}
          width={sizePixels}
          height={sizePixels}
          className="w-full h-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      </div>
      {showLabel && (
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
            {symbolUpper}
          </p>
        </div>
      )}
    </div>
  );
}
