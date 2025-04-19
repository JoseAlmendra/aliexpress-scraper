import puppeteer from 'puppeteer';
import fs from 'fs';
import express from 'express';

const app = express();
app.use(express.json());

// Cargar las cookies desde un archivo JSON (método más estándar)
const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));

// Función para hacer scraping de los detalles del pedido
async function scrapeOrderDetails(url) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Cargar las cookies para mantener la sesión activa
    await page.setCookie(...cookies);

    // Navegar al URL del pedido
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extraer los detalles del pedido
    const orderDetails = await page.evaluate(() => {
      const orderNumber = document.querySelector('.order-number-class')?.innerText || 'No order number found';
      const productName = document.querySelector('.product-name-class')?.innerText || 'No product name found';
      const price = document.querySelector('.price-class')?.innerText || 'No price found';
      return { orderNumber, productName, price };
    });

    await browser.close();
    return orderDetails;

  } catch (err) {
    console.error('Error durante el scraping:', err);
    throw new Error('Error en el scraping');
  }
}

// Endpoint para recibir las solicitudes POST con la URL
app.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ status: 'error', message: 'Falta la URL en la solicitud' });
  }

  try {
    const data = await scrapeOrderDetails(url);
    res.json(data); // Devuelve los detalles del pedido
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Algo salió mal al procesar la solicitud' });
  }
});

// Iniciar el servidor en el puerto 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
