import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAi, validateOrder, activeSubscription, enforceLimit } from '../netlify/functions/_security.mjs';
import { handler as ai } from '../netlify/functions/ai.mjs';
import { handler as publicOrder } from '../netlify/functions/public-order.mjs';
import { applySubscriptionToBusiness, ensureStripeCustomer } from '../netlify/functions/_billing.mjs';

const order = () => ({ businessId: 'A', requestId: '12345678-1234-1234-1234-123456789abc', customerName: 'Test', customerPhone: '123456789', scheduledFor: new Date(Date.now()+3600000).toISOString(), items: [{ productId: 1, qty: 1, extraIds: [] }] });
test('public input validation rejects malformed prices, quantities, extras and schedules', () => {
  assert.doesNotThrow(() => validateOrder(order()));
  for (const qty of [0, -1, 1.5, 100, '1', NaN]) assert.throws(() => validateOrder({ ...order(), items: [{ productId: 1, qty }] }));
  for (const extraIds of [[1,1], ['1'], null]) assert.throws(() => validateOrder({ ...order(), items: [{ productId: 1, qty: 1, extraIds }] }));
  assert.throws(() => validateOrder({ ...order(), scheduledFor: 'yesterday' }));
  assert.throws(() => validateOrder({ ...order(), scheduledFor: new Date(0).toISOString() }));
  assert.throws(() => validateOrder({ ...order(), customerName: {} }));
});
test('AI accepts bounded images and rejects arbitrary models and remote URLs', () => {
  assert.doesNotThrow(() => validateAi({ operation:'menu-scan', mode: 'json', prompt: 'Extract a receipt', imageBase64: 'data:image/jpeg;base64,YQ==' }));
  for (const change of [{ model: 'expensive-model' }, { prompt: 'a'.repeat(12001) }, { imageBase64: 'https://private.example/image' }, { mode: 'anything' }, { schema: [] }])
    assert.throws(() => validateAi({ operation:'brand-story', mode: 'text', prompt: 'menu', ...change }));
});
test('trial expiry is fail closed', () => {
  assert.equal(activeSubscription({ plan: 'pro' }), true);
  for (const trial_ends_at of [undefined, 'bad', new Date(0).toISOString()]) assert.equal(activeSubscription({ plan: 'trialing', trial_ends_at }), false);
  assert.equal(activeSubscription({ plan: 'trialing', trial_ends_at: new Date(Date.now()+10000).toISOString() }), true);
});
test('usage limits fail closed when shared storage fails', async () => {
  await assert.rejects(enforceLimit({ rpc: async () => ({ error: new Error('offline') }) }, 'x', 1, 60), e => e.status===503);
  await assert.rejects(enforceLimit({ rpc: async () => ({ data: false }) }, 'x', 1, 60), e => e.status===429);
});
test('AI handler requires authentication without calling upstream', async () => {
  process.env.OPENROUTER_API_KEY='test-only';
  const result=await ai({ httpMethod:'POST', headers:{}, body:'{}' });
  assert.equal(result.statusCode,401);
  assert.equal((await ai({ httpMethod:'GET', headers:{} })).statusCode,405);
});
test('authenticated AI uses a server model, token cap and shared limits', async () => {
  process.env.VITE_SUPABASE_URL='https://supabase.test'; process.env.VITE_SUPABASE_ANON_KEY='test-anon'; process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
  const original=globalThis.fetch; const calls=[];
  globalThis.fetch=async (url, init={}) => {
    const path=String(url); calls.push({ path, body: init.body && JSON.parse(init.body) });
    let body;
    if(path.includes('/auth/v1/user')) body={ id:'user-1' };
    else if(path.includes('/app_users')) body={ business_id:'A',role:'owner' };
    else if(path.includes('/businesses')) body={ id:'A',plan:'pro' };
    else if(path.includes('/rpc/previsio_rate_limit')) body=true;
    else if(path.includes('openrouter.ai')) body={ choices:[{message:{content:'result'}}] };
    else throw new Error(`Unexpected fetch ${path}`);
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const result=await ai({httpMethod:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({operation:'brand-story',mode:'text',prompt:'Describe this menu'})});
    assert.equal(result.statusCode,200,result.body);
    assert.equal(calls.filter(c=>c.path.includes('/rpc/')).length,2);
    assert.equal(calls.at(-1).body.max_tokens,4096);
    assert.equal(calls.at(-1).body.model,process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini');
  } finally { globalThis.fetch=original; }
});
test('public order computes trusted price and persists canonical fields', async () => {
  const original=globalThis.fetch; let inserted;
  globalThis.fetch=async (url,init={}) => {
    const path=String(url); let body;
    if(path.includes('/rpc/')) body=true;
    else if(path.includes('/orders') && init.method==='POST') { inserted=JSON.parse(init.body); return new Response(null,{status:201}); }
    else if(path.includes('/orders')) return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
    else if(path.includes('/businesses')) body={id:'A',plan:'pro',enabled_modules:{onlineOrders:true},currency_symbol:'€'};
    else if(path.includes('/products')) body=[{id:1,name_en:'Coffee',price:5,active:true,extra_ids:[]}];
    else throw new Error(`Unexpected fetch ${path}`);
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const payload={...order(),subtotal:0.01,items:[{productId:1,qty:2,price:0.01}]};
    const result=await publicOrder({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'127.0.0.1'},body:JSON.stringify(payload)});
    assert.equal(result.statusCode,200,result.body); assert.equal(inserted.subtotal,10);
    assert.ok(inserted.updated_at); assert.equal(inserted.created_by_fullname,'Online guest'); assert.ok(inserted.request_hash);
    assert.equal(inserted.last_updated_at,undefined);
  } finally {globalThis.fetch=original;}
});
test('billing update failures propagate so webhooks remain retryable',async()=>{
  const admin={from:()=>({update:()=>({eq:async()=>({error:{message:'offline'}})})})};
  await assert.rejects(applySubscriptionToBusiness(admin,'A',{id:'sub-1',status:'active',customer:'cus-1'}),/retry required/);
});
test('billing reads current period from subscription items', async()=>{
  let update;
  const admin={from:()=>({update:body=>{update=body;return {eq:async()=>({error:null})};}})};
  await applySubscriptionToBusiness(admin,'A',{id:'sub-1',status:'active',customer:'cus-1',items:{data:[{current_period_end:2000000000}]}});
  assert.equal(update.current_period_ends_at,new Date(2000000000*1000).toISOString());
});
test('AI invalid structured response is rejected', async()=>{
  const { validateStructured }=await import('../netlify/functions/_security.mjs');
  const schema={type:'object',required:['amount'],properties:{amount:{type:'number'}},additionalProperties:false};
  assert.equal(validateStructured({amount:12},schema),true);
  assert.equal(validateStructured({amount:'twelve'},schema),false);
  assert.equal(validateStructured({},schema),false);
  assert.equal(validateStructured({amount:12,unexpected:true},schema),false);
});
test('public order retry returns the same order and never inserts twice',async()=>{
  const { createHash }=await import('node:crypto');
  const payload=order(); const original=globalThis.fetch; let inserts=0;
  globalThis.fetch=async(url,init={})=>{
    if(init.method==='POST' && String(url).includes('/orders')) inserts++;
    const body=String(url).includes('/rpc/') ? true : {id:`ON-A-${payload.requestId}`,subtotal:5,request_hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try {
    const result=await publicOrder({httpMethod:'POST',headers:{},body:JSON.stringify(payload)});
    assert.equal(result.statusCode,200); assert.equal(inserts,0);
    const changed=await publicOrder({httpMethod:'POST',headers:{},body:JSON.stringify({...payload,customerName:'Different'})});
    assert.equal(changed.statusCode,409); assert.equal(inserts,0);
  } finally {globalThis.fetch=original;}
});

test('webhook reconciliation reads current Stripe state under a shared lease', async () => {
  const { reconcileSubscription } = await import('../netlify/functions/_billing.mjs');
  const events=[];
  const admin={rpc:async name=>{events.push(name);return {data:true,error:null};},from:()=>({update:()=>({eq:async()=>{events.push('write');return {error:null};}})})};
  const stripe={subscriptions:{retrieve:async()=>{events.push('retrieve');return {id:'sub',status:'active',customer:'cus'};}}};
  await reconcileSubscription(admin,stripe,'A','sub');
  assert.deepEqual(events,['previsio_claim_billing_lock','retrieve','write','previsio_release_billing_lock']);
});
test('busy webhook lease is retryable and never reads or writes subscription data', async () => {
  const { reconcileSubscription } = await import('../netlify/functions/_billing.mjs');
  await assert.rejects(reconcileSubscription({rpc:async()=>({data:false})},{},'A','sub'),/retry required/);
});

test('menu and receipt scans stop at shared rate limits before contacting AI', async () => {
 const original=globalThis.fetch;
 process.env.OPENROUTER_API_KEY='test-only';
 process.env.VITE_SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 let upstream=0;
 globalThis.fetch=async url=>{
  const path=String(url);let body;
  if(path.includes('/auth/v1/user'))body={id:'user-1'};
  else if(path.includes('/app_users'))body={business_id:'A',role:'owner'};
  else if(path.includes('/businesses'))body={id:'A',plan:'pro'};
  else if(path.includes('/rpc/previsio_rate_limit'))body=false;
  else {upstream++;throw new Error('AI must not be called');}
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try {
  for(const operation of ['menu-scan','receipt-scan']) {
   const result=await ai({httpMethod:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({operation,mode:'json',prompt:'Scan this'})});
   assert.equal(result.statusCode,429,result.body);
  }
  assert.equal(upstream,0);
 } finally {globalThis.fetch=original;}
});

test('public menu server needs URL and service key, not a separate anon key', async()=>{
 const {handler}=await import('../netlify/functions/public-menu.mjs');
 const keys=['VITE_SUPABASE_ANON_KEY','SUPABASE_ANON_KEY','SUPABASE_URL','VITE_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const original=globalThis.fetch;
 delete process.env.VITE_SUPABASE_ANON_KEY;delete process.env.SUPABASE_ANON_KEY;
 process.env.SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/businesses')?{id:'A',name:'Test',plan:'pro',enabled_modules:{onlineOrders:true}}:[{id:1,name_en:'Coffee',price:2,active:true}]),{status:200,headers:{'Content-Type':'application/json'}});
 try {
  const result=await handler({httpMethod:'GET',queryStringParameters:{businessId:'A'}});
  assert.equal(result.statusCode,200,result.body);assert.equal(JSON.parse(result.body).products.length,1);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const unavailable=await handler({httpMethod:'GET',queryStringParameters:{businessId:'A'}});
  assert.equal(unavailable.statusCode,503);assert.equal(JSON.parse(unavailable.body).code,'ORDERING_SERVER_NOT_CONFIGURED');
 } finally {globalThis.fetch=original;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

test('owner can scan during setup without a subscription; other access stays restricted', async () => {
 const original=globalThis.fetch;
 process.env.OPENROUTER_API_KEY='test-only';
 process.env.VITE_SUPABASE_URL='https://supabase.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
 let role='owner', setup=false, owner='user-1', upstream=0, limits=0;
 globalThis.fetch=async url=>{
  const path=String(url);let body;
  if(path.includes('/auth/v1/user'))body={id:'user-1'};
  else if(path.includes('/app_users'))body={business_id:'A',role};
  else if(path.includes('/businesses'))body={id:'A',plan:'none',setup_completed:setup,owner_user_id:owner};
  else if(path.includes('/rpc/previsio_rate_limit')){limits++;body=true;}
  else if(path.includes('openrouter.ai')){upstream++;body={choices:[{message:{content:JSON.stringify({products:[{name:'Coffee',price:3}]})}}]};}
  else throw new Error('Unexpected request');
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const request=operation=>ai({httpMethod:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({operation,mode:'json',prompt:'Read menu',imageBase64:'data:image/png;base64,YQ==',schema:{type:'object',required:['products'],properties:{products:{type:'array',items:{type:'object',required:['name','price'],properties:{name:{type:'string'},price:{type:'number'}}}}}}})});
 try {
  const success=await request('menu-scan');assert.equal(success.statusCode,200,success.body);assert.equal(limits,2);
  assert.equal((await request('receipt-scan')).statusCode,403);
  setup=true;assert.equal((await request('menu-scan')).statusCode,403);
  setup=false;role='manager';assert.equal((await request('menu-scan')).statusCode,403);
  role='owner';owner='other';assert.equal((await request('menu-scan')).statusCode,403);
  assert.equal(upstream,1);
 } finally {globalThis.fetch=original;}
});

test('production AI never accepts the local demo header as authentication', async () => {
 const result=await ai({httpMethod:'POST',headers:{'x-previsio-local-demo':'true'},body:JSON.stringify({operation:'menu-scan',mode:'text',prompt:'Read menu'})});
 assert.equal(result.statusCode,401);
});

test('receipt output budget is bounded separately and provider credit errors are actionable', async () => {
 const {createAiHandler}=await import('../netlify/functions/ai.mjs');
 const handler=createAiHandler(async()=>{});
 const original=globalThis.fetch;let status=200;const budgets=[];
 globalThis.fetch=async(_url,init)=>{
  budgets.push(JSON.parse(init.body).max_tokens);
  return new Response(JSON.stringify(status===200?{choices:[{message:{content:'OK'}}]}:{error:{message:'private provider detail'}}),{status});
 };
 const request=operation=>handler({httpMethod:'POST',headers:{},body:JSON.stringify({operation,mode:'text',prompt:'Read image'})});
 try {
  assert.equal((await request('receipt-scan')).statusCode,200);
  assert.equal((await request('menu-scan')).statusCode,200);
  assert.deepEqual(budgets,[512,4096]);
  status=402;const denied=await request('receipt-scan');
  assert.equal(denied.statusCode,402);assert.equal(JSON.parse(denied.body).code,'AI_CREDIT_LIMIT');
  assert.match(JSON.parse(denied.body).error,/credit limit/);
  assert.ok(!denied.body.includes('private provider detail'));
 } finally {globalThis.fetch=original;}
});
