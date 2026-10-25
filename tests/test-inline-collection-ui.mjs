import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('extension');
const server = http.createServer(async(req,res)=>{
 try { const file=path.join(root,new URL(req.url,'http://local').pathname); res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'); res.end(await fs.readFile(file)); }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
try {
 const page=await browser.newPage({viewport:{width:440,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const listeners=[];let run;const state={};window.testStarts=0;window.testStops=0;
  const emit=()=>listeners.forEach(fn=>fn({type:'RESEARCH_PROGRESS',payload:{run:structuredClone(run)}}));
  window.chrome={runtime:{id:'isolated-ui-test',getManifest:()=>({version:'1.7.7'}),onMessage:{addListener:fn=>listeners.push(fn),removeListener:()=>{}},sendMessage(message,cb){
   if(message.type==='START_RESEARCH'){
    window.testStarts++;const now=new Date().toISOString();
    run={runId:'ui-test',mode:'CUSTOM',keywords:message.payload.keywords,countryCode:'BD',locationName:'Bangladesh',status:'COLLECTING',leads:[],logs:[],startedAt:now,lastUpdatedAt:now,schemaVersion:1,totalAdsInspected:0,counters:{rawAds:0,normalizedCandidates:0,relevantCandidates:0,uncertainCandidates:0,notRelevantCandidates:0,duplicatesRemoved:0,finalUniqueLeads:0,finalUniqueRelevantLeads:0}};
    state.activeResearchRun=run;cb?.({success:true,run:structuredClone(run)});
    setTimeout(()=>{run.counters.finalUniqueLeads=7;run.counters.finalUniqueRelevantLeads=7;emit();},150);
   } else if(message.type==='STOP_RESEARCH') {window.testStops++;run.status='CANCELLED';emit();cb?.({success:true});} else cb?.({success:true});
   return Promise.resolve({success:true});
  }},tabs:{create:async()=>({id:1}),sendMessage:async()=>({})},storage:{local:{get:(keys,cb)=>{cb?.(state);return Promise.resolve(state);},set:(values,cb)=>{Object.assign(state,values);cb?.();return Promise.resolve();}}}};
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/sidepanel.html`);
 await page.getByRole('button',{name:'Start collecting',exact:true}).click();
 await page.getByRole('button',{name:'Stop',exact:true}).waitFor();
 await page.getByRole('status').filter({hasText:'Collecting leads'}).getByText('7',{exact:true}).waitFor();
 assert.equal(await page.getByRole('tab',{name:'Search',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.evaluate(()=>window.testStarts),1);
 const ring=page.locator('[aria-hidden=true].absolute.inset-0');
 assert.equal(await ring.evaluate(el=>getComputedStyle(el).width),'112px');
 assert.equal(await ring.evaluate(el=>getComputedStyle(el).animationName !== 'none'),true);
 await page.screenshot({path:'../outputs/LeadNoria-inline-collection.png',fullPage:true});
 await page.setViewportSize({width:360,height:780});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await page.getByRole('button',{name:'View leads & export',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.testStops),1);
 assert.deepEqual(errors,[]);
 console.log('PASS isolated browser UI: one-click start, same Search tab, no review dialog, updating count, Stop, export action, 360px layout, no page errors. Mock Chrome runtime only.');
} finally {await browser.close();server.close();}
