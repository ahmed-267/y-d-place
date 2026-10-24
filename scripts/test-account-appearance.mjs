import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3002');
 await page.getByRole('button',{name:/try demo/i}).first().click();
 await page.getByRole('button',{name:/Owner portal/}).click();
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 assert.equal(await page.locator('html').getAttribute('data-account-appearance'),'dark');
 const palettes=await page.evaluate(async()=>{
  const {BRAND_PALETTES,appearancePalette,relativeLuminance,applyBrandThemeToDocument}=await import('/src/utils/brandTheme.ts');
  return BRAND_PALETTES.map(base=>{
   const p=appearancePalette(base,'dark');
   applyBrandThemeToDocument({paletteId:base.id});
   return {id:base.id,mode:document.documentElement.dataset.accountAppearance,contrast:(relativeLuminance(p.ink)+0.05)/(relativeLuminance(p.card)+0.05)};
  });
 });
 assert.ok(palettes.every(p=>p.mode==='dark'&&p.contrast>=7),JSON.stringify(palettes));
 await page.evaluate(async()=>{const {applyBrandThemeToDocument}=await import('/src/utils/brandTheme.ts');applyBrandThemeToDocument({paletteId:'forest'});});
 await page.screenshot({path:'/tmp/previsio-account-dark.png'});
 for(const name of ['Cashier','Menu','Staff','Finance','Settings']) {
  await page.getByRole('button',{name,exact:true}).first().click();
  await page.waitForTimeout(250);
 }
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await page.locator('select').filter({has:page.locator('option[value=forest]')}).selectOption('forest');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('html').getAttribute('data-account-appearance'),'dark');
 await page.getByRole('button',{name:'Finance',exact:true}).first().click();
 await page.getByRole('button',{name:'Add Expense',exact:true}).first().click();
 await page.screenshot({path:'/tmp/previsio-account-dark-dialog.png'});
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/previsio-account-dark-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.reload();
 await page.getByRole('button',{name:'Switch to light mode'}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-account-appearance'),'dark');
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 assert.equal(await page.locator('html').getAttribute('data-account-appearance'),'light');
 assert.deepEqual(errors,[]);
 console.log('PASS: toggle, ten palettes with 7:1 primary contrast, account tabs, dialog, mobile, preference reload and light restoration.');
} finally {await browser.close();}
