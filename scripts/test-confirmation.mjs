import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page = await browser.newPage();
 page.on('pageerror', e => console.error(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
  const {ConfirmDialog}=await import('/src/components/ConfirmDialog.tsx');
  const {AppContext}=await import('/src/AppContext.tsx');
  window.confirmCalls=0;window.closeCalls=0;
  const host=document.createElement('div');host.id='confirmation-test';document.body.append(host);
  createRoot(host).render(React.createElement(AppContext.Provider,{value:{t:x=>x,addToast:()=>{}}},
   React.createElement(ConfirmDialog,{isOpen:true,title:'Test refund',message:'Synthetic transaction',confirmText:'Confirm refund',
    onClose:()=>window.closeCalls++,onConfirm:()=>{window.confirmCalls++;return new Promise(resolve=>window.finishConfirm=resolve);}})));
 });
 const button=page.getByRole('button',{name:'Confirm refund',exact:true});
 await button.click();
 assert.equal(await page.getByRole('button',{name:'Saving…',exact:true}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.closeCalls),0,'dialog stays open while server reply pending');
 await page.evaluate(()=>window.finishConfirm(false));
 await button.waitFor();
 assert.equal(await page.evaluate(()=>window.closeCalls),0,'failed save retains confirmation');
 await button.click();
 await page.evaluate(()=>window.finishConfirm(true));
 await page.waitForFunction(()=>window.closeCalls===1);
 assert.equal(await page.evaluate(()=>window.confirmCalls),2);
 console.log('PASS: confirmation waits for server, disables duplicate clicks, retains failure, closes on success.');
} finally {await browser.close();}
