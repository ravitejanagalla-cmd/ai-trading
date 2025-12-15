import { NextRequest, NextResponse } from "next/server";
import { getLiveMarketData } from "@/lib/scrapers/live-market-poller";
import { getFundamentalData as fetchFundamentals } from "@/lib/scrapers/fundamental-data";
import { getHistoricalData } from "@/lib/scrapers/nse-scraper";
import { createGeminiGroundingScraperService } from "@/lib/scrapers/gemini-grounding-scraper";
import { calculateIndicators } from "@/lib/analysis/data-fetcher";
import { fetchEnhancedNews } from "@/lib/scrapers/enhanced-news-fetcher";
import {
  storeFundamentalData,
  getFundamentalData as getCachedFundamentals,
  storeEnrichedNews,
  getRecentNews,
  storeTechnicalAnalysis,
  getTechnicalAnalysis,
} from "@/lib/data/enriched-data";

/**
 * GET /api/market/ticker?symbol=TCS
 * Fetch comprehensive ticker data with enrichment from NeonDB
 */
export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: "Symbol parameter required" },
        { status: 400 }
      );
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`📊 Fetching ticker data for ${upperSymbol}...`);

    // Step 1: Fetch live market data
    console.log(`💱 Fetching live data for ${upperSymbol}...`);
    const liveData = await getLiveMarketData(upperSymbol).catch((err) => {
      console.warn(`⚠️ Live data fetch failed:`, err);
      return null;
    });

    // Step 2: Fetch or get cached fundamental data
    console.log(`📈 Fetching fundamental data for ${upperSymbol}...`);
    let fundamentalData = await getCachedFundamentals(upperSymbol).catch(
      () => null
    );

    if (!fundamentalData) {
      // Try Gemini grounding first
      try {
        console.log(
          `🔍 Trying Gemini grounding for fundamentals of ${upperSymbol}...`
        );
        const geminiService = createGeminiGroundingScraperService();
        const geminiData = await geminiService.getFundamentalDataViaGrounding(
          upperSymbol
        );

        if (geminiData && Object.keys(geminiData).length > 1) {
          fundamentalData = geminiData;
          console.log(
            `✅ Got fundamental data from Gemini grounding for ${upperSymbol}`
          );
        }
      } catch (err) {
        console.warn(
          `⚠️ Gemini grounding fundamentals fetch failed for ${upperSymbol}:`,
          err
        );
      }
    }

    // Fallback to traditional scraper
    if (!fundamentalData) {
      fundamentalData = await fetchFundamentals(upperSymbol).catch((err) => {
        console.warn(`⚠️ Fundamental data fetch failed:`, err);
        return null;
      });
    }

    // Cache it if we got data
    if (fundamentalData) {
      await storeFundamentalData(upperSymbol, fundamentalData).catch((err) =>
        console.warn(`⚠️ Failed to cache fundamentals:`, err)
      );
    }

    // Step 3: Fetch historical data for technical analysis
    console.log(`📉 Fetching historical data for ${upperSymbol}...`);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    let historicalData: any[] = [];

    // Try Gemini grounding first (most reliable with web search)
    try {
      console.log(`🔍 Trying Gemini grounding for ${upperSymbol}...`);
      const geminiService = createGeminiGroundingScraperService();
      historicalData = await Promise.race([
        geminiService.getHistoricalDataViaGrounding(
          upperSymbol,
          formatDate(startDate),
          formatDate(endDate)
        ),
        new Promise<any[]>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 30000)
        ),
      ]);

      if (historicalData && historicalData.length > 0) {
        console.log(
          `✅ Got ${historicalData.length} records from Gemini grounding for ${upperSymbol}`
        );
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      if (
        errMsg.includes("quota") ||
        errMsg.includes("429") ||
        errMsg.includes("rate limit")
      ) {
        console.warn(`⚠️ Gemini rate limited, using fallback scraper`);
      } else {
        console.warn(
          `⚠️ Gemini grounding fetch failed for ${upperSymbol}:`,
          err
        );
      }
    }

    // Fallback to NSE scraper if Gemini didn't work
    if (!historicalData || historicalData.length === 0) {
      historicalData = await getHistoricalData(
        upperSymbol,
        formatDate(startDate),
        formatDate(endDate)
      ).catch((err) => {
        console.warn(`⚠️ Historical data fetch failed:`, err);
        return [];
      });
    }

    // Step 4: Calculate technical indicators
    console.log(`📊 Calculating technical indicators for ${upperSymbol}...`);
    const technicalIndicators =
      historicalData && historicalData.length > 0
        ? calculateIndicators(historicalData)
        : {
            trend: "Unknown",
            momentum: 0,
            volatility: 0,
            currentPrice: liveData?.price || 0,
            ma5: 0,
            ma20: 0,
          };

    // Store technical analysis
    if (technicalIndicators.trend !== "Unknown") {
      await storeTechnicalAnalysis(upperSymbol, formatDate(new Date()), {
        trend: technicalIndicators.trend,
        momentum: Number(technicalIndicators.momentum) || 0,
        volatility: Number(technicalIndicators.volatility) || 0,
        rsi: 0,
        macd: { value: 0, signal: 0, histogram: 0 },
        movingAverages: {
          ma5: Number(technicalIndicators.ma5) || 0,
          ma20: Number(technicalIndicators.ma20) || 0,
          ma50: 0,
        },
      }).catch((err) =>
        console.warn(`⚠️ Failed to store technical analysis:`, err)
      );
    }

    // Step 5: Fetch enhanced news from multiple sources
    console.log(`📰 Fetching enhanced news for ${upperSymbol}...`);
    let newsData: any[] = [];

    try {
      newsData = await fetchEnhancedNews(upperSymbol, 7).catch(() => []);
      console.log(
        `✅ Fetched ${newsData.length} news articles for ${upperSymbol}`
      );

      // Store enriched news
      if (newsData.length > 0) {
        await storeEnrichedNews(upperSymbol, newsData).catch((err) =>
          console.warn(`⚠️ Failed to store enriched news:`, err)
        );
      }
    } catch (err) {
      console.warn(`⚠️ Enhanced news fetch failed, trying cached news...`);
      try {
        newsData = await getRecentNews(upperSymbol, 7, 10).catch(() => []);
      } catch {
        newsData = [];
      }
    }

    // Validate we have at least some data
    if (!liveData && !fundamentalData && historicalData.length === 0) {
      return NextResponse.json(
        { success: false, error: `No data available for ${symbol}` },
        { status: 404 }
      );
    }

    console.log(
      `✅ Ticker data complete: live=${!!liveData}, fundamentals=${!!fundamentalData}, historical=${
        historicalData.length
      }, news=${newsData.length}`
    );

    return NextResponse.json({
      success: true,
      data: {
        symbol: upperSymbol,
        live: liveData,
        fundamental: fundamentalData || {},
        technical: {
          indicators: technicalIndicators,
          historicalDays: historicalData?.length || 0,
        },
        news: newsData || [],
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Ticker data fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch ticker data",
      },
      { status: 500 }
    );
  }
}
