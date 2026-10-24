import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'test@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{full_name:'Test Owner',username:'test'},app_metadata:{provider:'email'},created_at:new Date().toISOString()};
const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')}.test`;
try {
 for(const scenario of ['new-owner','schema-error','unconfirmed','confirmation-link','onboarding-save-error']) {
  const context=await browser.newContext();const page=await context.newPage();const errors=[];let profileReads=0;let provisionCalls=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return route.continue();
   const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(u.pathname==='/auth/v1/token')return scenario==='unconfirmed'?reply({code:'email_not_confirmed',msg:'Email not confirmed'},400):reply({access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
   if(u.pathname==='/auth/v1/user')return reply(user);
   if(u.pathname==='/rest/v1/app_users'){
    profileReads++;
    if(scenario==='schema-error')return reply({code:'42703',message:'column app_users.numeric_id does not exist'},400);
    return reply(null);
   }
   if(u.pathname==='/rest/v1/rpc/previsio_provision_business') {
    provisionCalls++;
    const {settings}=route.request().postDataJSON();
    assert.equal(settings.name,'Test Cafe');assert.equal(settings.city,'London');
    if(scenario==='onboarding-save-error' && provisionCalls===1) return reply({message:'Synthetic database failure',code:'P0001'},400);
    return reply({business:{...settings,id:'test-cafe',owner_user_id:uid,setup_completed:false,plan:'none'},numeric_id:1,username:'test',full_name:'Test Owner'});
   }
   if(u.pathname==='/rest/v1/businesses')return reply(null);
   if(u.pathname.startsWith('/rest/v1/'))return reply([]);
   return route.abort();
  });
  if(scenario==='confirmation-link') {
   await page.goto(`http://127.0.0.1:3000/login#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,{waitUntil:'networkidle'});
   await page.waitForURL('**/onboarding',{timeout:8000});
   assert.ok(profileReads>0);assert.deepEqual(errors,[]);
   console.log('PASS: confirmation link opens onboarding without a second login');
   await context.close();continue;
  }
  await page.goto('http://127.0.0.1:3000/login',{waitUntil:'networkidle'});
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('TestPassword123!');
  await page.locator('button[type=submit]').click();
  if(scenario==='new-owner' || scenario==='onboarding-save-error') {
   await page.waitForURL('**/onboarding',{timeout:8000});
   assert.ok(profileReads>0,'profile query completes outside auth lock');
   await page.getByPlaceholder(/business name/i).fill('Test Cafe');
   await page.getByPlaceholder('City',{exact:true}).fill('London');
   await page.getByRole('button',{name:'Continue',exact:true}).click();
   if(scenario==='onboarding-save-error') {
    await page.getByText('Synthetic database failure',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).isEnabled(),true);
    assert.equal(await page.getByPlaceholder(/business name/i).inputValue(),'Test Cafe');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
   }
   await page.getByRole('heading',{name:'Build your menu',exact:true}).waitFor();
   assert.equal(provisionCalls,scenario==='onboarding-save-error'?2:1);
  } else if(scenario==='schema-error') {
   await page.getByText(/Unable to load your account:.*numeric_id/).first().waitFor({timeout:8000});
   assert.ok(page.url().endsWith('/login'),'schema errors do not route to onboarding');
   assert.equal(await page.locator('button[type=submit]').isEnabled(),true);
  } else {
   await page.getByRole('button',{name:/resend confirmation/i}).waitFor({timeout:8000});
   assert.equal(await page.locator('button[type=submit]').isEnabled(),true);
  }
  assert.deepEqual(errors,[]);console.log(`PASS: ${scenario}`);await context.close();
 }
} finally {await browser.close();}
