#!/usr/bin/env node

/**
 * Standalone Node.js scraper with stealth plugin
 * Runs outside Next.js to avoid compilation issues
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

        const news = [];

        // MoneyControl
        try {
            await page.goto(`https://www.moneycontrol.com/news/tags/${symbol.toLowerCase()}.html`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const mcNews = await page.evaluate(() => {
                const items = [];
                const articles = document.querySelectorAll('.clearfix, .news_list');

                articles.forEach(article => {
                    const titleEl = article.querySelector('h2 a, h3 a');
                    const dateEl = article.querySelector('.date, time');
                    const summaryEl = article.querySelector('p');

                    if (titleEl) {
                        items.push({
                            title: titleEl.textContent?.trim() || '',
                            summary: summaryEl?.textContent?.trim() || '',
                            date: dateEl?.textContent?.trim() || new Date().toISOString(),
                            source: 'MoneyControl'
                        });
                    }
                });

                return items;
            });

            news.push(...mcNews.slice(0, 5));
        } catch (error) {
            console.error('MoneyControl failed:', error.message);
        }

        // Economic Times
        try {
            await page.goto(`https://economictimes.indiatimes.com/topic/${symbol}`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const etNews = await page.evaluate(() => {
                const items = [];
                const articles = document.querySelectorAll('.eachStory, article');

                articles.forEach(article => {
                    const titleEl = article.querySelector('h3 a, h2 a');
                    const summaryEl = article.querySelector('p');

                    if (titleEl) {
                        items.push({
                            title: titleEl.textContent?.trim() || '',
                            summary: summaryEl?.textContent?.trim() || '',
                            date: new Date().toISOString().split('T')[0],
                            source: 'Economic Times'
                        });
                    }
                });

                return items;
            });

            news.push(...etNews.slice(0, 5));
        } catch (error) {
            console.error('Economic Times failed:', error.message);
        }

        await browser.close();

        // Output as JSON
        console.log(JSON.stringify({ success: true, news }));
        process.exit(0);
    } catch (error) {
        console.error(JSON.stringify({ success: false, error: error.message }));
        if (browser) await browser.close();
        process.exit(1);
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
