import puppeteer from 'puppeteer';
import fs from 'fs';
import express from 'express';

const app = express();
app.use(express.json());

// Cargar las cookies desde un archivo JSON
const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));

// Función para hacer scraping de los detalles del pedido
async function scrapeOrderDetails(url) {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Si no quieres que el navegador sea visible
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Esto resuelve el problema de root
    });
    const page = await browser.newPage();

    // Filtrar las cookies que tienen sameSite como null
    const validCookies = cookies.filter(cookie => cookie.sameSite !== null);

    // Cargar las cookies válidas para mantener la sesión activa
    await page.setCookie(...validCookies);

    // Navegar al URL del pedido
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extraer los detalles del pedido
    const orderDetails = await page.evaluate(() => {
      const orderNumberElement = document.querySelector('.order-detail-info-item.order-detail-order-info .info-row:first-child > span:nth-child(2)');
      const orderNumber = orderNumberElement?.innerText.replace('Nº de pedido:\u00A0', '') || 'No order number found';

      const orderDateElement = document.querySelector('.order-detail-info-item.order-detail-order-info .info-row:nth-child(2) > span:nth-child(2)');
      const orderDate = orderDateElement?.innerText.replace('Pedido efectuado el:\u00A0', '') || 'No order date found';

      const storeNameElement = document.querySelector('.order-detail-item-store .store-name');
      const storeName = storeNameElement?.innerText.trim() || 'No store name found';

      const productImageElement = document.querySelector('.order-detail-item-content-img');
      const productImage = productImageElement?.style.backgroundImage.slice(4, -2).replace(/_220x220\.jpg/, '') || 'No product image found';

      const productNameElement = document.querySelector('.order-detail-item-content-info .item-title a');
      const productName = productNameElement?.innerText.trim() || 'No product name found';

      const totalPriceElement = document.querySelector('.order-price .order-price-item.bold-font .rightPriceClass .es--wrap--1Hlfkoj');
      const totalPrice = totalPriceElement?.innerText.trim() || 'No total price found';

      return {
        orderNumber,
        orderDate,
        storeName,
        productImage,
        productName,
        totalPrice
      };
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
