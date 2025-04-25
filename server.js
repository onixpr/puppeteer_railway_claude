const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Puppeteer service running');
});

// Scrape endpoint
app.post('/scrape', async (req, res) => {
  const { url, selectors, actions } = req.body;

  console.log('Received /scrape request:', req.body); // helpful for Railway logs

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true
      // REMOVED executablePath to prevent crash on Railway
    });

    const page = await browser.newPage();

    // Set user agent and headers to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 60 seconds
    });
    console.log(`Navigation complete for ${url}`);

    const results = {};

    // Extract selectors if any
    if (selectors) {
      for (const [key, selector] of Object.entries(selectors)) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          results[key] = await page.$eval(selector, el => el.textContent.trim());
        } catch (error) {
          results[key] = `Error: ${error.message}`;
        }
      }
    }

    // Perform actions if any
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
          console.error(`Action error: ${error.message}`);
        }
      }
    }

    results.pageTitle = await page.title();
    results.fullHtml = await page.content();

    await browser.close();

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Puppeteer service listening at http://localhost:${port}`);
});
