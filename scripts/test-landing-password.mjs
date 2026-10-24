import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3002');
 assert.equal(await page.getByText('Live in three steps',{exact:true}).count(),0);
 assert.equal(await page.locator('#tour').getByText('Your catalogue, linked to stock').count(),0);
 await page.locator('#tour').scrollIntoViewIfNeeded();await page.waitForTimeout(700);
 await page.locator('#tour').screenshot({path:'/tmp/previsio-landing-tour.png'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no overflow at ${width}`);
 }
 await page.getByLabel('Toggle dark mode').click();
 await page.locator('#tour').screenshot({path:'/tmp/previsio-landing-tour-light.png'});
 await page.goto('http://127.0.0.1:3002/login');
 await page.locator('#login-password').fill('Test-password-123!');
 await page.getByRole('button',{name:'Show password',exact:true}).click();
 assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
 assert.equal(await page.locator('#login-password').inputValue(),'Test-password-123!');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();
 assert.equal(await page.locator('#login-password').getAttribute('type'),'password');
 await page.screenshot({path:'/tmp/previsio-password-toggle.png'});
 await page.goto('http://127.0.0.1:3002/register');
 await page.locator('#register-password').fill('Test-password-123!');
 await page.getByRole('button',{name:'Show password',exact:true}).first().click();
 assert.equal(await page.locator('#register-password').getAttribute('type'),'text');
 assert.equal(await page.locator('#register-confirm-password').getAttribute('type'),'password');
 assert.deepEqual(errors,[]);
 console.log('PASS: shortened landing, responsive layouts, light/dark, login and independent registration visibility controls. No authentication requests submitted.');
}finally{await browser.close();}
