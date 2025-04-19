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

    // Esperar un poco más por si acaso hay carga dinámica
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('LOG: Espera adicional de 3 segundos completada (con setTimeout).');

    const htmlContent = await page.evaluate(() => {
      console.log('LOG: Dentro de page.evaluate() - Retornando HTML.');
      return document.body.innerHTML;
    });

    await browser.close();
    console.log('LOG: Navegador cerrado.');
    console.log('LOG: HTML del body:', htmlContent); // Loguea el HTML en Railway
    return { html: htmlContent }; // Retorna el HTML en la respuesta

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
    res.json(data); // Devuelve el HTML en la respuesta
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Algo salió mal al procesar la solicitud' });
  }
});

// Iniciar el servidor en el puerto 8080
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});
