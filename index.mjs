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

    const validCookies = cookies.filter(cookie => cookie.sameSite !== null);
    await page.setCookie(...validCookies);
    console.log('LOG: Cookies establecidas.');

    console.log(`LOG: Navegando a la URL: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('LOG: Navegación completada (domcontentloaded).');

    // Esperar un poco más por si acaso hay carga dinámica
    await page.waitForTimeout(3000); // Espera 3 segundos
    console.log('LOG: Espera adicional de 3 segundos completada.');

    const orderDetails = await page.evaluate(() => {
      console.log('LOG: Dentro de page.evaluate().');

      const orderNumberElement = document.querySelector('.order-detail-info-item.order-detail-order-info .info-row:first-child > span:nth-child(2)');
      const orderNumber = orderNumberElement?.innerText.replace('Nº de pedido:\u00A0', '') || 'No order number found';
      console.log('LOG: orderNumber encontrado:', orderNumber);

      const orderDateElement = document.querySelector('.order-detail-info-item.order-detail-order-info .info-row:nth-child(2) > span:nth-child(2)');
      const orderDate = orderDateElement?.innerText.replace('Pedido efectuado el:\u00A0', '') || 'No order date found';
      console.log('LOG: orderDate encontrado:', orderDate);

      const storeNameElement = document.querySelector('.order-detail-item-store .store-name');
      const storeName = storeNameElement?.innerText.trim() || 'No store name found';
      console.log('LOG: storeName encontrado:', storeName);

      const productImageElement = document.querySelector('.order-detail-item-content-img');
      const productImage = productImageElement?.style.backgroundImage.slice(4, -2).replace(/_220x220\.jpg/, '') || 'No product image found';
      console.log('LOG: productImage encontrado:', productImage);

      const productNameElement = document.querySelector('.order-detail-item-content-info .item-title a');
      const productName = productNameElement?.innerText.trim() || 'No product name found';
      console.log('LOG: productName encontrado:', productName);

      const totalPriceElement = document.querySelector('.order-price .order-price-item.bold-font .rightPriceClass .es--wrap--1Hlfkoj');
      const totalPrice = totalPriceElement?.innerText.trim() || 'No total price found';
      console.log('LOG: totalPrice encontrado:', totalPrice);

      const extractedData = {
        orderNumber,
        orderDate,
        storeName,
        productImage,
        productName,
        totalPrice
      };
      console.log('LOG: Datos extraídos dentro de evaluate:', extractedData);
      return extractedData;
    });

    await browser.close();
    console.log('LOG: Navegador cerrado.');
    console.log('LOG: Datos finales a retornar:', orderDetails);
    return orderDetails;

  } catch (err) {
    console.error('LOG: Error durante el scraping:', err);
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
