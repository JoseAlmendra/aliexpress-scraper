import puppeteer from 'puppeteer';
import fs from 'fs';
import express from 'express';

const app = express();
app.use(express.json());

// Cargar las cookies desde un archivo JSON
const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
console.log('LOG: Cookies cargadas del archivo.');

// Función para hacer scraping de los detalles del pedido
async function scrapeOrderDetails(url) {
  try {
    console.log('LOG: Iniciando scrapeOrderDetails para la URL:', url);
    const browser = await puppeteer.launch({
      headless: true, // Si no quieres que el navegador sea visible
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Esto resuelve el problema de root
    });
    const page = await browser.newPage();
    console.log('LOG: Nuevo navegador y página creados.');

    const validCookies = cookies.filter(cookie => cookie.sameSite !== null);
    await page.setCookie(...validCookies);
    console.log('LOG: Cookies establecidas en la página.');

    console.log('LOG: Navegando a la URL:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('LOG: Navegación completada (domcontentloaded).');

    console.log('LOG: Esperando selectores clave.');
    try {
      await page.waitForSelector('.order-detail-info-item.order-detail-order-info', { timeout: 5000 });
      await page.waitForSelector('.order-price .order-price-item', { timeout: 5000 });
      console.log('LOG: Selectores clave cargados. Iniciando extracción.');
    } catch (error) {
      console.error('LOG: Error al esperar selectores clave:', error);
      console.log('LOG: Intentando extraer con los elementos cargados hasta ahora.');
    }

    const extractionResult = await page.evaluate(() => {
      console.log('LOG: Dentro de page.evaluate().');
      try {
        const orderInfoBlock = document.querySelector('.order-detail-info-item.order-detail-order-info .order-detail-info-content');
        console.log('LOG: orderInfoBlock encontrado:', !!orderInfoBlock);

        let orderNumber = 'No order number found';
        const orderIdLabel = orderInfoBlock?.querySelector('.info-row:first-child > span[data-pl="order_detail_gray_id"]');
        console.log('LOG: orderIdLabel encontrado:', !!orderIdLabel, 'Texto:', orderIdLabel?.textContent);
        if (orderIdLabel?.textContent?.includes('Order ID:')) {
          orderNumber = orderIdLabel.nextSibling?.textContent?.trim();
          console.log('LOG: orderNumber extraído:', orderNumber);
        }

        let orderDate = 'No order date found';
        const orderDateLabel = orderInfoBlock?.querySelector('.info-row:nth-child(2) > span[data-pl="order_detail_gray_date"]');
        console.log('LOG: orderDateLabel encontrado:', !!orderDateLabel, 'Texto:', orderDateLabel?.textContent);
        if (orderDateLabel?.textContent?.includes('Order placed on:')) {
          orderDate = orderDateLabel.nextSibling?.textContent?.trim();
          console.log('LOG: orderDate extraído:', orderDate);
        }

        const storeNameElement = document.querySelector('.order-detail-item-store .store-name');
        const storeName = storeNameElement?.innerText?.trim() || 'No store name found';
        console.log('LOG: storeName encontrado:', storeName);

        const productImageElement = document.querySelector('.order-detail-item-content-img');
        const productImage = productImageElement?.style.backgroundImage?.slice(4, -2)?.replace(/(_\d+x\d+\.jpg)?$/, '') || 'No product image found';
        console.log('LOG: productImage encontrado:', productImage);

        const productNameElement = document.querySelector('.order-detail-item-content-info .item-title a');
        const productName = productNameElement?.innerText?.trim() || 'No product name found';
        console.log('LOG: productName encontrado:', productName);

        // Precio total (maneja el caso de spans individuales)
        let totalPrice = 'No total price found';
        const totalPriceContainer = document.querySelector('.order-price .order-price-item .rightPriceClass .es--wrap--1Hlfkoj');
        if (totalPriceContainer) {
          totalPrice = Array.from(totalPriceContainer.children)
            .map(span => span.innerText)
            .join('');
          console.log('LOG: totalPrice extraído (con spans):', totalPrice);
        } else {
          const totalPriceElement = document.querySelector('.order-price .order-price-item.bold-font .rightPriceClass');
          totalPrice = totalPriceElement?.innerText?.trim() || 'No total price found';
          console.log('LOG: totalPrice extraído (sin spans):', totalPrice);
        }

        const html = document.body.innerHTML;
        console.log('LOG: HTML del body extraído.');

        const extractedData = {
          orderNumber,
          orderDate,
          storeName,
          productImage,
          productName,
          totalPrice
        };
        console.log('LOG: Datos extraídos dentro de evaluate:', extractedData);
        return { data: extractedData, html };
      } catch (error) {
        console.error('LOG: Error dentro de page.evaluate():', error);
        return {
          data: {
            orderNumber: 'Error during extraction',
            orderDate: 'Error during extraction',
            storeName: 'Error during extraction',
            productImage: 'Error during extraction',
            productName: 'Error during extraction',
            totalPrice: 'Error during extraction'
          },
          html: 'Error during HTML extraction'
        };
      }
    });

    await browser.close();
    console.log('LOG: Navegador cerrado.');
    console.log('LOG: Datos finales a retornar:', extractionResult.data);
    return { ...extractionResult.data, html: extractionResult.html };

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
    const dataWithHtml = await scrapeOrderDetails(url);
    res.json(dataWithHtml); // Devuelve los detalles del pedido y el HTML
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Algo salió mal al procesar la solicitud' });
  }
});

// Iniciar el servidor en el puerto 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
