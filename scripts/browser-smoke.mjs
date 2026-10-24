import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PREVISIO_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1' ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});

  const demo=page.getByRole('button',{name:/try demo/i}).first();
  await demo.click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', {name:/Owner portal/}).click();
  await page.waitForTimeout(1500);
  for (const name of ['Cashier','Orders','Sales','Stock','Menu','Staff','Finance','Settings','Overview']) {
    await page.getByRole('button', {name, exact:true}).first().click();
    await page.waitForTimeout(200);
    assert.ok((await page.locator('main').innerText()).trim().length > 0, `${name} renders`);
  }
  await page.getByRole('button', {name:'Cashier', exact:true}).first().click();
  await page.waitForTimeout(300);
  const countSales = () => page.evaluate(() => JSON.parse(localStorage.getItem('previsio_ops_v1:ydplace') || '{}').sales?.length || 0);
  const before = await countSales();
  await page.getByRole('button', {name:/Still Water/}).click();
  await page.getByRole('button', {name:'Card recorded',exact:true}).click();
  await page.getByRole('button', {name:'Pay & complete now',exact:true}).click();
  await page.waitForTimeout(300);
  assert.equal(await countSales(),before+1,'demo checkout saves one sale');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await countSales(),before+1,'demo sale survives reload');
  await page.getByRole('button', {name:'Manager',exact:true}).click();
  await page.waitForTimeout(300);
  assert.ok((await page.locator('main').innerText()).length>0,'manager demo renders');
  await page.getByRole('button', {name:'Staff',exact:true}).last().click();
  await page.waitForTimeout(300);
  assert.ok((await page.locator('main').innerText()).length>0,'staff demo renders');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  assert.ok((await page.locator('main').innerText()).length>0,'mobile layout renders');
  console.log('PASS: owner tabs, demo checkout, reload, manager/staff portals, mobile layout.');
  console.log('Page errors:',errors);
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
