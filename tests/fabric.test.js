const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function loader(fetchFn) {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  const start = html.indexOf('function loadFabric(){');
  const end = html.indexOf('// 품목', start);
  const ctx = { SHEET_ID: 'old-sheet', API_KEY: 'old-key', XMLHttpRequest: class {
    open(method,url) { this.url=url; }
    send() { this.status=200; this.responseText=JSON.stringify({values:payload.rows}); this.onload(); }
  }, fetch: fetchFn, AbortSignal, Date, Promise, console, _fData: null, _fLoadedAt: 0, _fPending: null,
    FABRIC_API_URL: 'https://fabric-search-six.vercel.app/api/search' };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start,end),ctx);
  return ctx;
}
const payload = {source:'supabase', rows:[['W1148','37,000','','142','','alias','WF',''],['','','','','','']]};
test('loads Supabase API and maps public quote fields',async()=>{
  const calls=[];
  const c=loader(async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>payload};});
  const rows=await c.loadFabric();
  assert.equal(calls[0].url,'https://fabric-search-six.vercel.app/api/search');
  assert.equal(calls[0].opts.cache,'no-store');
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),[{name:'W1148',price:'37000',spec:'142mm',alias:'alias'}]);
});
test('deduplicates in-flight reads, expires successful cache after 60s',async()=>{
  let count=0;
  const c=loader(async()=>{count++;return {ok:true,json:async()=>payload};});
  const first=c.loadFabric();
  assert.equal(c.loadFabric(),first);
  await first;
  await c.loadFabric();
  assert.equal(count,1);
  c._fLoadedAt=Date.now()-61000;
  await c.loadFabric();
  assert.equal(count,2);
});
test('rejects wrong-source/malformed responses and permits retry',async()=>{
  let body={source:'sheets',rows:[]};
  const c=loader(async()=>({ok:true,json:async()=>body}));
  await assert.rejects(c.loadFabric(),/단가/);
  body={source:'supabase',rows:[null]};
  await assert.rejects(c.loadFabric(),/단가/);
  body=payload;
  assert.equal((await c.loadFabric())[0].price,'37000');
});
test('network failure retries and supplies a timeout signal',async()=>{
  let count=0;
  const c=loader(async(url,opts)=>{
    assert.ok(opts.signal);
    if(++count===1) throw new Error('offline');
    return {ok:true,json:async()=>payload};
  });
  await assert.rejects(c.loadFabric(),/offline/);
  assert.equal((await c.loadFabric()).length,1);
});
test('autocomplete ignores a completed request after input was cleared',async()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const start=html.indexOf('function onAcInput(inp){');
  const end=html.indexOf('function onAcKey(',start);
  let resolve;
  const dd={style:{},innerHTML:'',appendChild(){}};
  const inp={value:'W1148',parentNode:{querySelector(){return dd;}}};
  const ctx={loadFabric:()=>new Promise(r=>{resolve=r;}),document:{createElement:()=>({})},console};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  ctx.onAcInput(inp);
  inp.value='';ctx.onAcInput(inp);
  dd.innerHTML='untouched';
  resolve([{name:'W1148',price:'37000',spec:'142mm',alias:''}]);
  await new Promise(r=>setImmediate(r));
  assert.equal(dd.innerHTML,'untouched');
});
test('autocomplete reports a failed read without an unhandled rejection',async()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const start=html.indexOf('function onAcInput(inp){');
  const end=html.indexOf('function onAcKey(',start);
  const dd={style:{},innerHTML:'',textContent:''};
  const inp={value:'W1148',parentNode:{querySelector(){return dd;}}};
  const ctx={loadFabric:()=>Promise.reject(new Error('offline')),console};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);ctx.onAcInput(inp);
  await new Promise(r=>setImmediate(r));
  assert.match(dd.textContent,/단가.*다시/);
});
module.exports={loader,payload};
