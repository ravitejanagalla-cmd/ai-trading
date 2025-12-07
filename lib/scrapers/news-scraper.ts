import { spawn } from 'child_process';
import path from 'path';

export interface NewsItem {
  date: string;
  title: string;
  summary: string;
  source: string;
  sentiment?: string;
}

/**
 * Scrape news using standalone Node.js script with stealth plugin
 */
export async function scrapeStockNews(symbol: string, days: number = 7): Promise<NewsItem[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'scrape-news.js');
    
    const child = spawn('node', [scriptPath, symbol, days.toString()], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            resolve(result.news || []);
          } else {
            console.error('News scraping failed:', result.error);
            resolve([]);
          }
        } catch (error) {
          console.error('Failed to parse news output:', errorOutput);
          resolve([]);
        }
      } else {
        console.error('News scraper exited with code', code, errorOutput);
        resolve([]);
      }
    });

    // Timeout after 45 seconds
    setTimeout(() => {
      child.kill();
      resolve([]);
    }, 45000);
  });
}

/**
 * Analyze news sentiment using LLM
 */
export async function analyzeNewsSentiment(news: NewsItem[]): Promise<{ overall: string; score: number }> {
  if (news.length === 0) {
    return { overall: 'Neutral', score: 0 };
  }

  // Count positive/negative keywords
  const positiveKeywords = ['growth', 'profit', 'gain', 'surge', 'rally', 'beat', 'strong', 'positive'];
  const negativeKeywords = ['loss', 'decline', 'fall', 'drop', 'weak', 'miss', 'concern', 'negative'];

  let positiveCount = 0;
  let negativeCount = 0;

  news.forEach(item => {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    positiveKeywords.forEach(kw => {
      if (text.includes(kw)) positiveCount++;
    });
    negativeKeywords.forEach(kw => {
      if (text.includes(kw)) negativeCount++;
    });
  });

  const total = positiveCount + negativeCount;
  if (total === 0) return { overall: 'Neutral', score: 0 };

  const score = (positiveCount - negativeCount) / total;
  
  let overall = 'Neutral';
  if (score > 0.3) overall = 'Positive';
  else if (score < -0.3) overall = 'Negative';

  return { overall, score };
}
