import puppeteer from 'puppeteer';
import fs from 'fs';

// Cargar las cookies desde un archivo JSON
import cookies from './cookies.json' assert { type: 'json' };

// Función para hacer scraping de los detalles del pedido
async function scrapeOrderDetails(url) {
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
}

// Llamada a la función con la URL del pedido
scrapeOrderDetails('https://www.aliexpress.com/p/order/detail.html?spm=a2g0o.order_list.order_list_main.1.3828194dG7dX8H&orderId=8200614052238417')
  .then(result => {
    console.log(result); // Muestra los detalles del pedido en la consola
  })
  .catch(err => {
    console.error(err); // Muestra el error en caso de que algo salga mal
  });
