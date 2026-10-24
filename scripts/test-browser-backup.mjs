import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage();
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 await page.goto('http://127.0.0.1:3000/', {waitUntil:'networkidle'});
 await page.evaluate(async () => {
  const React = (await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {BrowserBackup} = await import('/src/components/BrowserBackup.tsx');
  const {supabase} = await import('/src/components/supabaseClient.ts');
  window.backupCalls = [];
  window.backupFail = true;
  supabase.rpc = async (name, args) => {
   window.backupCalls.push({name,args});
   return window.backupFail ? {error:{message:'Simulated network failure'}} : {data:new Date().toISOString(),error:null};
  };
  localStorage.setItem('previsio_ops_v1:TEST',JSON.stringify({businessId:'TEST',customers:[{name:'Recovery customer'}],users:[{password:'must-not-upload'}],sales:[{id:'must-not-upload'}]}));
  const host = document.createElement('div'); host.id='backup-test'; document.body.prepend(host);
  createRoot(host).render(React.createElement(BrowserBackup,{businessId:'TEST'}));
 });
 const area = page.locator('#backup-test');
 await area.getByText('Automatic backup needs attention', {exact:true}).waitFor();
 assert.match(await area.innerText(),/Simulated network failure/);
 await page.evaluate(() => { window.backupFail = false; window.dispatchEvent(new Event('online')); });
 await area.getByRole('button',{name:/Local data backed up:/}).waitFor();
 const calls = await page.evaluate(() => window.backupCalls);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[1].args.snapshot.customers,[{name:'Recovery customer'}]);
 assert.equal('users' in calls[1].args.snapshot,false);
 assert.equal('sales' in calls[1].args.snapshot,false);
 assert.equal(calls[0].args.device,calls[1].args.device);
 await page.evaluate(() => window.dispatchEvent(new CustomEvent('previsio-local-save-failed',{detail:{businessId:'TEST'}})));
 await area.getByText('Local save failed — latest changes are not backed up',{exact:true}).waitFor();
 await page.evaluate(() => window.dispatchEvent(new Event('online')));
 assert.equal(await page.evaluate(() => window.backupCalls.length),2,'storage failure must not confirm stale cached data');
 console.log('PASS: visible failure, automatic reconnect retry, stable device identity, credential/cloud-record exclusion, local storage failure protection.');
} finally {await browser.close();}
