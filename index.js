import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  const cookies = JSON.parse(await fs.readFile('./cookies.json', 'utf8'));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCookie(...cookies);
  await page.goto(url, { waitUntil: 'networkidle2' });

  const data = await page.evaluate(() => {
    const orderNumber = document.querySelector('.order-number')?.textContent;
    const productName = document.querySelector('.product-title')?.textContent;
    const price = document.querySelector('.product-price')?.textContent;
    return { orderNumber, productName, price };
  });

  await browser.close();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Scraper running on port ${PORT}`);
});
