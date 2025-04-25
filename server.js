const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Puppeteer service running');
});

app.post('/scrape', async (req, res) => {
  const { url, selectors, actions } = req.body;

  console.log('Incoming request to /scrape:', req.body);

  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  let browser;
  const results = {};

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Handle selectors
    if (selectors) {
      for (const [key, selector] of Object.entries(selectors)) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          results[key] = await page.$eval(selector, el => el.textContent.trim());
        } catch (error) {
          results[key] = `Selector error: ${error.message}`;
        }
      }
    }

    // Handle actions
    if (actions) {
      for (const action of actions) {
        try {
          if (action.type === 'click' && action.selector) {
            await page.click(action.selector);
          } else if (action.type === 'type' && action.selector && action.value) {
            await page.type(action.selector, action.value);
          } else if (action.type === 'screenshot') {
            results.screenshot = await page.screenshot({ encoding: 'base64' });
          }
        } catch (error) {
          results.actionError = `Action error: ${error.message}`;
        }
      }
    }

    results.pageTitle = await page.title();

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify({ success: true, data: results }));
  } catch (error) {
    console.error('Scraping failed:', error);
    res.status(500).send(JSON.stringify({ success: false, error: error.message }));
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
});
  
app.listen(port, () => {
  console.log(`Puppeteer service listening at http://localhost:${port}`);
});
