#!/usr/bin/env node

/**
 * Enhanced news scraper with multiple sources and better extraction
 */

const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin
puppeteerExtra.use(StealthPlugin());

async function scrapeNews(symbol, days = 7) {
    let browser = null;

    try {
        browser = await puppeteerExtra.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        const allNews = [];

        // Source 1: MoneyControl
        try {
            console.error(`Scraping MoneyControl for ${symbol}...`);
            const mcNews = await scrapeMoneyControl(page, symbol);
            allNews.push(...mcNews);
        } catch (error) {
            console.error('MoneyControl failed:', error.message);
        }

        // Source 2: Business Standard
        try {
            console.error(`Scraping Business Standard for ${symbol}...`);
            const bsNews = await scrapeBusinessStandard(page, symbol);
            allNews.push(...bsNews);
        } catch (error) {
            console.error('Business Standard failed:', error.message);
        }

        // Source 3: Mint (Livemint)
        try {
            console.error(`Scraping Mint for ${symbol}...`);
            const mintNews = await scrapeMint(page, symbol);
            allNews.push(...mintNews);
        } catch (error) {
            console.error('Mint failed:', error.message);
        }

        // Source 4: The Hindu BusinessLine
        try {
            console.error(`Scraping The Hindu BusinessLine for ${symbol}...`);
            const blNews = await scrapeBusinessLine(page, symbol);
            allNews.push(...blNews);
        } catch (error) {
            console.error('BusinessLine failed:', error.message);
        }

        // Source 5: Google News (fallback)
        try {
            console.error(`Scraping Google News for ${symbol}...`);
            const gNews = await scrapeGoogleNews(page, symbol);
            allNews.push(...gNews);
        } catch (error) {
            console.error('Google News failed:', error.message);
        }

        await browser.close();

        // Deduplicate and filter junk
        const uniqueNews = [];
        const seen = new Set();
        const junkWords = ['login', 'hello', 'my account', 'sign up', 'subscribe', 'upcoming', 'latest news', 'all schedule', 'javascript:'];

        for (const item of allNews) {
            const title = item.title.toLowerCase().trim();
            const key = title;

            // Filter junk
            const isJunk = junkWords.some(word => title.includes(word.toLowerCase())) ||
                item.url.includes('javascript:') ||
                title.length < 15 ||
                !title.match(/[a-z]/i); // Should have letters

            if (!seen.has(key) && !isJunk && item.title.length > 10) {
                seen.add(key);
                uniqueNews.push(item);
            }
        }

        console.log(JSON.stringify({ success: true, news: uniqueNews }));
        process.exit(0);
    } catch (error) {
        console.error(JSON.stringify({ success: false, error: error.message }));
        if (browser) await browser.close();
        process.exit(1);
    }
}

async function scrapeMoneyControl(page, symbol) {
    try {
        await page.goto(`https://www.moneycontrol.com/news/tags/${symbol.toLowerCase()}.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        return await page.evaluate(() => {
            const items = [];
            const articles = document.querySelectorAll('.clearfix, .news_list li, article');

            articles.forEach(article => {
                const titleEl = article.querySelector('h2 a, h3 a, a');
                const summaryEl = article.querySelector('p');
                const dateEl = article.querySelector('.date, time, span[class*="date"]');

                if (titleEl && titleEl.textContent.trim().length > 10) {
                    items.push({
                        title: titleEl.textContent.trim(),
                        summary: summaryEl?.textContent?.trim() || '',
                        date: dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0],
                        source: 'MoneyControl',
                        url: titleEl.href || ''
                    });
                }
            });

            return items.slice(0, 8);
        });
    } catch (error) {
        console.error('MoneyControl scrape error:', error.message);
        return [];
    }
}

async function scrapeBusinessStandard(page, symbol) {
    try {
        await page.goto(`https://www.business-standard.com/search?q=${symbol}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        return await page.evaluate(() => {
            const items = [];
            const articles = document.querySelectorAll('.listingstyle, article, .headline');

            articles.forEach(article => {
                const titleEl = article.querySelector('h2 a, h3 a, a.headline');
                const summaryEl = article.querySelector('p, .stry');

                if (titleEl && titleEl.textContent.trim().length > 10) {
                    items.push({
                        title: titleEl.textContent.trim(),
                        summary: summaryEl?.textContent?.trim() || '',
                        date: new Date().toISOString().split('T')[0],
                        source: 'Business Standard',
                        url: titleEl.href || ''
                    });
                }
            });

            return items.slice(0, 5);
        });
    } catch (error) {
        console.error('Business Standard scrape error:', error.message);
        return [];
    }
}

async function scrapeMint(page, symbol) {
    try {
        await page.goto(`https://www.livemint.com/Search/Link/keyword-${symbol}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        return await page.evaluate(() => {
            const items = [];
            const articles = document.querySelectorAll('.headline, .searchList li, article');

            articles.forEach(article => {
                const titleEl = article.querySelector('h2 a, h3 a, a');
                const summaryEl = article.querySelector('p');

                if (titleEl && titleEl.textContent.trim().length > 10) {
                    items.push({
                        title: titleEl.textContent.trim(),
                        summary: summaryEl?.textContent?.trim() || '',
                        date: new Date().toISOString().split('T')[0],
                        source: 'Mint',
                        url: titleEl.href || ''
                    });
                }
            });

            return items.slice(0, 5);
        });
    } catch (error) {
        console.error('Mint scrape error:', error.message);
        return [];
    }
}

async function scrapeBusinessLine(page, symbol) {
    try {
        await page.goto(`https://www.thehindubusinessline.com/search/?q=${symbol}`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        return await page.evaluate(() => {
            const items = [];
            const articles = document.querySelectorAll('.story-card, article');

            articles.forEach(article => {
                const titleEl = article.querySelector('h3 a, h2 a, a');
                const summaryEl = article.querySelector('p');

                if (titleEl && titleEl.textContent.trim().length > 10) {
                    items.push({
                        title: titleEl.textContent.trim(),
                        summary: summaryEl?.textContent?.trim() || '',
                        date: new Date().toISOString().split('T')[0],
                        source: 'The Hindu BusinessLine',
                        url: titleEl.href || ''
                    });
                }
            });

            return items.slice(0, 5);
        });
    } catch (error) {
        console.error('BusinessLine scrape error:', error.message);
        return [];
    }
}

async function scrapeGoogleNews(page, symbol) {
    try {
        await page.goto(`https://news.google.com/search?q=${symbol}+stock+india`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        return await page.evaluate(() => {
            const items = [];
            const articles = document.querySelectorAll('article, .xrnccd');

            articles.forEach(article => {
                const titleEl = article.querySelector('a[class*="JtKRv"]');

                if (titleEl && titleEl.textContent.trim().length > 10) {
                    items.push({
                        title: titleEl.textContent.trim(),
                        summary: '',
                        date: new Date().toISOString().split('T')[0],
                        source: 'Google News',
                        url: titleEl.href || ''
                    });
                }
            });

            return items.slice(0, 10);
        });
    } catch (error) {
        console.error('Google News scrape error:', error.message);
        return [];
    }
}

// CLI usage
const symbol = process.argv[2];
const days = parseInt(process.argv[3]) || 7;

if (!symbol) {
    console.error(JSON.stringify({ success: false, error: 'Symbol required' }));
    process.exit(1);
}

scrapeNews(symbol, days);
