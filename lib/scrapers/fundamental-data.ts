import axios from 'axios';
import { FundamentalData } from '@/lib/types';

/**
 * Fetch fundamental data from Yahoo Finance
 */
async function fetchFromYahooFundamentals(symbol: string): Promise<FundamentalData | null> {
  try {
    const formats = [`${symbol}.NS`, `${symbol}.BO`, symbol];

    for (const ticker of formats) {
      try {
        const response = await axios.get(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,defaultKeyStatistics,financialData,summaryDetail`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
            validateStatus: () => true,
          }
        );

        if (response.status === 200 && response.data?.quoteSummary?.result?.[0]) {
          const result = response.data.quoteSummary.result[0];
          const asset = result.assetProfile || {};
          const stats = result.defaultKeyStatistics || {};
          const financial = result.financialData || {};
          const summary = result.summaryDetail || {};

          return {
            symbol,
            companyName: asset.longName || symbol,
            sector: asset.sector || 'N/A',
            industry: asset.industry || 'N/A',
            marketCap: stats.marketCap?.raw || 0,
            peRatio: stats.trailingPE?.raw || 0,
            pbRatio: stats.priceToBook?.raw || 0,
            eps: stats.trailingEps?.raw || 0,
            dividendYield: summary.dividendYield?.raw || 0,
            debtToEquity: financial.debtToEquity?.raw || 0,
            roe: financial.returnOnEquity?.raw || 0,
            roic: financial.returnOnCapital?.raw || 0,
            currentRatio: financial.currentRatio?.raw || 0,
            quickRatio: financial.quickRatio?.raw || 0,
            netMargin: financial.profitMargins?.raw || 0,
            operatingMargin: financial.operatingMargins?.raw || 0,
            assetTurnover: financial.assetTurnover?.raw || 0,
            bookValue: stats.bookValue?.raw || 0,
            tangibleBookValue: stats.tangibleBookValue?.raw || 0,
            priceToBook: stats.priceToBook?.raw || 0,
             priceToSales: stats.priceToSalesTrailing12Months?.raw || 0,
             evToEbitda: stats.enterpriseToEbitda?.raw || 0,
             weekHigh50: summary.fiftyTwoWeekHigh?.raw || 0,
             weekLow50: summary.fiftyTwoWeekLow?.raw || 0,
             weekChange52: stats['52WeekChange']?.raw || 0,
             beta: stats.beta?.raw || 0,
             avgVolume: summary.averageVolume?.raw || 0,
             description: asset.longBusinessSummary || '',
             website: asset.website || '',
             employees: asset.fullTimeEmployees || 0,
            };
            }
            } catch {
            continue;
            }
            }

            return null;
            } catch (error) {
            console.warn(`Fundamental data fetch failed for ${symbol}:`, error);
            return null;
            }
            }

/**
 * Fetch fundamental data from Finnhub
 */
async function fetchFromFinnhubFundamentals(symbol: string): Promise<Partial<FundamentalData> | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;

    const formats = [symbol, `${symbol}.NS`];

    for (const ticker of formats) {
      try {
        const [companyResponse, metricsResponse] = await Promise.all([
          axios.get('https://finnhub.io/api/v1/company-profile2', {
            params: { symbol: ticker, token: apiKey },
            timeout: 10000,
            validateStatus: () => true,
          }),
          axios.get('https://finnhub.io/api/v1/stock/metric', {
            params: { symbol: ticker, metric: 'all', token: apiKey },
            timeout: 10000,
            validateStatus: () => true,
          }),
        ]);

        if (
          companyResponse.status === 200 &&
          companyResponse.data &&
          metricsResponse.status === 200 &&
          metricsResponse.data
        ) {
          const company = companyResponse.data;
          const metrics = metricsResponse.data.metric || {};

          return {
            symbol,
            companyName: company.name || symbol,
            sector: company.finnhubIndustry || 'N/A',
            industry: company.finnhubIndustry || 'N/A',
            marketCap: metrics.marketCapitalization || 0,
            peRatio: metrics.peAnnual || 0,
            pbRatio: metrics.priceToBook || 0,
            eps: metrics.eps || 0,
            dividendYield: metrics.dividendYieldIndicatedAnnual || 0,
            beta: metrics.beta || 0,
            description: company.description || '',
            website: company.weburl || '',
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn(`Finnhub fundamentals fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get comprehensive fundamental data with fallbacks
 */
export async function getFundamentalData(symbol: string): Promise<FundamentalData | null> {
  // Try Yahoo Finance first
  let data = await fetchFromYahooFundamentals(symbol);
  if (data) return data;

  // Try Finnhub as fallback
  const finnhubData = await fetchFromFinnhubFundamentals(symbol);
  if (finnhubData) {
    return {
      symbol,
      companyName: finnhubData.companyName || symbol,
      sector: finnhubData.sector || 'N/A',
      industry: finnhubData.industry || 'N/A',
      marketCap: finnhubData.marketCap || 0,
      peRatio: finnhubData.peRatio || 0,
      pbRatio: finnhubData.pbRatio || 0,
      eps: finnhubData.eps || 0,
      dividendYield: finnhubData.dividendYield || 0,
      debtToEquity: 0,
      roe: 0,
      roic: 0,
      currentRatio: 0,
      quickRatio: 0,
      netMargin: 0,
      operatingMargin: 0,
      assetTurnover: 0,
      bookValue: 0,
      tangibleBookValue: 0,
      priceToBook: finnhubData.pbRatio || 0,
      priceToSales: 0,
      evToEbitda: 0,
      weekHigh50: 0,
      weekLow50: 0,
      weekChange52: 0,
      beta: finnhubData.beta || 0,
      avgVolume: 0,
      description: finnhubData.description || '',
      website: finnhubData.website || '',
      };
      }

      console.warn(`No fundamental data available for ${symbol}`);
      return null;
      }
