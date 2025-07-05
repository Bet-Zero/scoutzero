import puppeteer from 'puppeteer';

export async function exportRosterToPng(url, outputPath) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1200, height: 975 });
    const buffer = await page.screenshot({ path: outputPath, type: 'png' });
    return buffer;
  } finally {
    await browser.close();
  }
}
