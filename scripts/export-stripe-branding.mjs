import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const dir = new URL('../public/branding/', import.meta.url);
await mkdir(dir, {recursive:true});
const icon = await readFile(new URL('../public/favicon.svg', import.meta.url),'utf8');
const mark = icon.replace(/<svg[^>]*>/,'').replace('</svg>','');
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320"><g transform="translate(24 40) scale(3.75)">${mark}</g><text x="310" y="207" font-family="Georgia, serif" font-size="168" font-weight="bold" letter-spacing="-6" fill="#2A241F">PreVisio</text></svg>`;
await writeFile(new URL('previsio-icon.svg',dir),icon);
await writeFile(new URL('previsio-logo.svg',dir),logo);
const browser = await chromium.launch({headless:true});
try {
 for (const [name,svg,width,height] of [['icon',icon,512,512],['logo',logo,1200,320]]) {
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`);
  await page.screenshot({path:new URL(`previsio-${name}.png`,dir).pathname,omitBackground:true});
  await page.close();
 }
} finally {await browser.close();}
console.log('Exported Stripe icon (512×512) and logo (1200×320).');
