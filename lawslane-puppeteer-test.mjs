import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('pageerror', error => {
    console.error(`Page Error: ${error.message}`);
  });
  
  page.on('error', error => {
    console.error(`Error: ${error.message}`);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console Error: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:9002/th', { waitUntil: 'networkidle0' });
  await browser.close();
})();
