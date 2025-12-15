"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  BarChart,
  ReferenceLine,
} from "recharts";

interface ChartData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockPriceChartProps {
  data?: ChartData[];
  symbol: string;
  height?: number;
}

type TimeRange = "1d" | "1w" | "1m" | "6m" | "1y" | "ytd" | "max";

const DAYS_MAP: Record<TimeRange, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "6m": 180,
  "1y": 365,
  ytd: 365, // Year-to-date (same as 1 year for consistent data)
  max: 730, // Maximum ~2 years of data
};

export function StockPriceChart({
  data: initialData,
  symbol,
  height = 400,
}: StockPriceChartProps) {
  const [data, setData] = useState<ChartData[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("1m");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [touchDistance, setTouchDistance] = useState(0);
  const [lastGestureScale, setLastGestureScale] = useState(1);

  // Handle macOS trackpad pinch gesture (gesturechange event)
  const handleGestureChange = (e: any) => {
    e.preventDefault();
    const scaleDiff = e.scale - lastGestureScale;

    // Scale increases/decreases by ~0.01 per pinch movement
    if (Math.abs(scaleDiff) > 0.01) {
      const direction = scaleDiff > 0 ? 0.05 : -0.05;
      setZoomLevel((prev) => Math.max(1, Math.min(4, prev + direction)));
      setLastGestureScale(e.scale);
    }
  };

  const handleGestureEnd = () => {
    setLastGestureScale(1);
  };

  // Handle wheel event pinch (Windows/Linux trackpad or keyboard zoom)
  const handleWheel = (e: WheelEvent) => {
    // Detect pinch gesture: Ctrl on Windows/Linux, Meta (Cmd) on macOS
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      // Negative deltaY = zoom in, Positive deltaY = zoom out
      const direction = e.deltaY < 0 ? 0.1 : -0.1;
      setZoomLevel((prev) => Math.max(1, Math.min(4, prev + direction)));
    }
  };

  // Handle touch pinch gesture (mobile)
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && touchDistance > 0) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      // Calculate pinch direction
      const diff = distance - touchDistance;
      if (Math.abs(diff) > 5) {
        // Only trigger after 5px movement
        const zoomChange = diff > 0 ? 0.1 : -0.1;
        setZoomLevel((prev) => Math.max(1, Math.min(4, prev + zoomChange)));
        setTouchDistance(distance);
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchDistance(0);
  };

  // Add event listeners on component mount
  useEffect(() => {
    const chartContainer = document.querySelector("[data-chart-container]");
    if (chartContainer) {
      // macOS trackpad pinch (Safari/Chrome)
      (chartContainer as any).addEventListener(
        "gesturechange",
        handleGestureChange,
        {
          passive: false,
        }
      );
      (chartContainer as any).addEventListener("gestureend", handleGestureEnd);

      // Wheel event (Windows/Linux and fallback)
      chartContainer.addEventListener("wheel", handleWheel, { passive: false });

      // Touch pinch (mobile)
      chartContainer.addEventListener("touchstart", handleTouchStart);
      chartContainer.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      chartContainer.addEventListener("touchend", handleTouchEnd);

      return () => {
        (chartContainer as any).removeEventListener(
          "gesturechange",
          handleGestureChange
        );
        (chartContainer as any).removeEventListener(
          "gestureend",
          handleGestureEnd
        );
        chartContainer.removeEventListener("wheel", handleWheel);
        chartContainer.removeEventListener("touchstart", handleTouchStart);
        chartContainer.removeEventListener("touchmove", handleTouchMove);
        chartContainer.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [touchDistance, lastGestureScale]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const days = DAYS_MAP[timeRange];

        // Always fetch fresh data when time range changes
        const response = await fetch(
          `/api/market/historical?symbol=${symbol}&days=${days}`
        );
        if (!response.ok) throw new Error("Failed to fetch historical data");
        const result = await response.json();

        if (result.data && result.data.length > 0) {
          // Calculate cutoff date for filtering
          const now = new Date();
          const cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - days);
          // Set to start of day for proper comparison
          cutoffDate.setHours(0, 0, 0, 0);

          // Filter to only include data within the requested range
          const filteredData = result.data.filter((item: any) => {
            const itemDate = new Date(item.date);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate >= cutoffDate;
          });

          // Use filtered data if we got meaningful results, otherwise use all returned data
          const dataToUse =
            filteredData.length > 0 ? filteredData : result.data;
          setData(dataToUse);
        } else {
          setData([]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error loading chart data"
        );
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    // Reset zoom level when changing time range
    setZoomLevel(1);
    fetchData();
  }, [symbol, timeRange]);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Sort by date ascending (oldest to newest, left to right)
    const sorted = [...data].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    return sorted.map((item) => {
      const dateObj = new Date(item.date);
      return {
        date: String(item.date),
        open: parseFloat(String(item.open || 0)),
        high: parseFloat(String(item.high || 0)),
        low: parseFloat(String(item.low || 0)),
        close: parseFloat(String(item.close || 0)),
        volume: parseInt(String(item.volume || 0)),
        // Extract month-day for cleaner x-axis
        dateLabel: dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        // Full date format for hover tooltip (dd-mmm-yyyy)
        fullDate: dateObj.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    });
  }, [data]);

  // Apply zoom to data
  const zoomedData = useMemo(() => {
    if (zoomLevel === 1 || chartData.length === 0) return chartData;

    const itemsToShow = Math.max(5, Math.floor(chartData.length / zoomLevel));
    const startIdx = Math.max(0, chartData.length - itemsToShow);
    return chartData.slice(startIdx);
  }, [chartData, zoomLevel]);

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-700">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-700">
        <p className="text-red-400">{error || "No data available"}</p>
      </div>
    );
  }

  const minPrice = Math.min(...zoomedData.map((d) => d.low)) * 0.99;
  const maxPrice = Math.max(...zoomedData.map((d) => d.high)) * 1.01;

  const currentPrice = chartData[chartData.length - 1]?.close || 0;
  const previousPrice = chartData[0]?.close || currentPrice;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = ((priceChange / previousPrice) * 100).toFixed(2);

  return (
    <div
      className="w-full bg-slate-900 rounded-lg p-6 border border-slate-700"
      data-chart-container
      style={{ touchAction: "none" }}
    >
      {/* Header with price info */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div className="flex items-baseline gap-4">
            <h3 className="text-2xl font-bold text-white">{symbol}</h3>
            <span className="text-3xl font-bold text-green-400">
              ₹{currentPrice.toFixed(2)}
            </span>
            <span
              className={`text-lg font-semibold ${
                priceChange >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)} ({priceChangePercent}%)
            </span>
          </div>
          <div className="flex gap-4 flex-wrap">
            {/* Time Range Filter Buttons */}
            <div className="flex gap-2">
              {(["1d", "1w", "1m", "6m", "1y", "ytd", "max"] as const).map(
                (range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setTimeRange(range);
                      setZoomLevel(1);
                    }}
                    className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                      timeRange === range
                        ? "bg-emerald-600 text-white shadow-lg"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {range === "ytd"
                      ? "YTD"
                      : range === "max"
                      ? "2Y"
                      : range.toUpperCase()}
                  </button>
                )
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex gap-2 items-center border-l border-slate-600 pl-4">
              <button
                onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
                disabled={zoomLevel <= 1}
                className="px-2 py-1 text-sm font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Zoom out"
              >
                🔍−
              </button>
              <span className="text-slate-400 text-xs font-medium min-w-[40px] text-center">
                {zoomLevel === 1 ? "1:1" : `${(zoomLevel * 100).toFixed(0)}%`}
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.5))}
                disabled={zoomLevel >= 4}
                className="px-2 py-1 text-sm font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Zoom in"
              >
                🔍+
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                disabled={zoomLevel === 1}
                className="px-2 py-1 text-sm font-medium rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Reset zoom"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-sm">
          {chartData.length} trading days • {chartData[0]?.dateLabel || "N/A"}{" "}
          to {chartData[chartData.length - 1]?.dateLabel || "N/A"}
        </p>
        <p className="text-gray-500 text-xs mt-2">
          💡 Mac: Two-finger pinch • Windows: Ctrl + Scroll • Buttons: 🔍±
        </p>
      </div>

      {/* Price Chart */}
      <div className="mb-8">
        <h4 className="text-gray-300 text-sm font-semibold mb-4">
          Price Movement
        </h4>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart
            data={zoomedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: "#94a3b8" }}
              axisLine={{ stroke: "#475569" }}
              interval={Math.floor(Math.max(0, zoomedData.length / 6 - 1))}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: "#94a3b8" }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => (
                <span className="text-green-400">₹{value.toFixed(2)}</span>
              )}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  const fullDate = payload[0].payload?.fullDate;
                  return (
                    <span className="text-slate-200 font-semibold">
                      {fullDate || label}
                    </span>
                  );
                }
                return <span className="text-gray-300">{label}</span>;
              }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#colorPrice)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* OHLC Chart */}
      <div className="mb-8">
        <h4 className="text-gray-300 text-sm font-semibold mb-4">
          Open/High/Low/Close
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={zoomedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: "#94a3b8" }}
              axisLine={{ stroke: "#475569" }}
              interval={Math.floor(Math.max(0, zoomedData.length / 6 - 1))}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: "#94a3b8" }}
              axisLine={{ stroke: "#475569" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number) => (
                <span className="text-gray-300">₹{value.toFixed(2)}</span>
              )}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  const fullDate = payload[0].payload?.fullDate;
                  return (
                    <span className="text-slate-200 font-semibold">
                      {fullDate || label}
                    </span>
                  );
                }
                return <span className="text-gray-300">{label}</span>;
              }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
            <Line
              type="monotone"
              dataKey="open"
              stroke="#3b82f6"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              name="Open"
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="#10b981"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              name="High"
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke="#ef4444"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              name="Low"
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Close"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      {zoomedData.some((d) => d.volume > 0) && (
        <div>
          <h4 className="text-gray-300 text-sm font-semibold mb-4">Volume</h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={zoomedData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: "#94a3b8" }}
                axisLine={{ stroke: "#475569" }}
                interval={Math.floor(Math.max(0, zoomedData.length / 6 - 1))}
              />
              <YAxis
                tick={{ fill: "#94a3b8" }}
                axisLine={{ stroke: "#475569" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(value: number) => (
                  <span className="text-blue-400">
                    {(value / 1000000).toFixed(2)}M
                  </span>
                )}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    const fullDate = payload[0].payload?.fullDate;
                    return (
                      <span className="text-slate-200 font-semibold">
                        {fullDate || label}
                      </span>
                    );
                  }
                  return <span className="text-gray-300">{label}</span>;
                }}
              />
              <Bar
                dataKey="volume"
                fill="#6366f1"
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StockPriceChart;
