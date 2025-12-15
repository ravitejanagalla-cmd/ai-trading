import type { Browser, Page } from 'puppeteer';

// Lazy load puppeteer to avoid SSR issues  
let puppeteerInstance: any = null;

/**
 * Dynamically load puppeteer (stealth applied via page.evaluateOnNewDocument)
 */
async function loadPuppeteer() {
  if (puppeteerInstance) {
    return puppeteerInstance;
  }

  // Load plain puppeteer - stealth will be applied in createStealthPage
  const puppeteer = await import('puppeteer');
  puppeteerInstance = puppeteer.default || puppeteer;
  
  console.log('✅ Puppeteer loaded (stealth mode enabled via page configuration)');
  return puppeteerInstance;
}


export interface ScraperOptions {
  headless?: boolean;
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
}

const DEFAULT_OPTIONS: ScraperOptions = {
  headless: process.env.SCRAPER_HEADLESS === 'true',
  timeout: parseInt(process.env.SCRAPER_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3'),
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Initialize a stealth browser instance
 */
export async function initBrowser(options: ScraperOptions = {}): Promise<Browser> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Load puppeteer dynamically
  const puppeteer = await loadPuppeteer();
  
  const browser = await puppeteer.launch({
    headless: opts.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  return browser;
}

/**
 * Create a new page with anti-detection settings
 */
export async function createStealthPage(browser: Browser, options: ScraperOptions = {}): Promise<Page> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const page = await browser.newPage();

  // Set viewport with random variations
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  });

  // Set user agent
  await page.setUserAgent(opts.userAgent!);

  // Disable image loading to speed up scraping
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
      request.abort();
    } else {
      request.continue();
    }
  });

  // Remove webdriver flag and mock browser properties
  await page.evaluateOnNewDocument(() => {
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Mock plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer', version: '1' },
        { name: 'Chrome PDF Viewer', description: 'Portable Document Format', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', version: '1' },
        { name: 'Native Client Executable', description: 'Native Client Executable', filename: 'internal-nacl-plugin', version: '1' }
      ]
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // Override permissions query
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
        originalQuery(parameters)
    );

    // Mock chrome object (Chromium detection)
    (window as any).chrome = {
      runtime: {}
    };

    // Mock toString methods
    window.console.debug = () => {};
    window.console.log = () => {};
  });

  // Add realistic headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,en;q=0.8',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Referer': 'https://www.nseindia.com/',
    'Origin': 'https://www.nseindia.com',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
  });

  return page;
}

/**
 * Retry wrapper for flaky operations
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${i + 1}/${maxRetries} failed: ${lastError.message}`);
      
      if (i < maxRetries - 1) {
        // Exponential backoff with jitter
        const backoff = delay * Math.pow(2, i) + Math.random() * 1000;
        await sleep(backoff);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random delay to mimic human behavior
 */
export async function randomDelay(min: number = 500, max: number = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleep(delay);
}

/**
 * Safely click element with retries
 */
export async function safeClick(page: Page, selector: string, timeout: number = 5000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
  await randomDelay(100, 300);
  await page.click(selector);
}

/**
 * Safely type text with human-like delays
 */
export async function safeType(page: Page, selector: string, text: string, timeout: number = 5000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
  await randomDelay(200, 500);
  await page.type(selector, text, { delay: 50 + Math.random() * 100 });
}

/**
 * Handle cookie consent popups
 */
export async function handleCookieConsent(page: Page): Promise<void> {
  const consentSelectors = [
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("OK")',
    '#cookie-accept',
    '.cookie-consent-accept',
  ];

  for (const selector of consentSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        await randomDelay(500, 1000);
        break;
      }
    } catch {
      // Ignore if selector not found
    }
  }
}

/**
 * Extract text from element
 */
export async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    return await page.evaluate(el => el.textContent?.trim() || null, element);
  } catch {
    return null;
  }
}

/**
 * Check if page is blocked (CAPTCHA, etc.)
 */
export async function isPageBlocked(page: Page): Promise<boolean> {
  const content = await page.content();
  const blockedIndicators = [
    'captcha',
    'Access Denied',
    'blocked',
    'unusual traffic',
    'robot',
    'verification',
  ];

  return blockedIndicators.some(indicator => 
    content.toLowerCase().includes(indicator.toLowerCase())
  );
}
