import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const profile=await fs.mkdtemp(path.join(os.tmpdir(),'leadnoria-mv3-'));
const extension=path.resolve('extension');
const visits=[];
const names=['Furniture Shop Zero','বাংলা Furniture House'];
const phones=['+8801712345678','+8801812345678'];
const card=(i)=>`<div class="ad-card" style="padding:20px;margin:20px;border:1px solid"><span>Library ID: ${991000000000001+i}</span><div>Active</div><a href="https://www.facebook.com/FixtureShop${i}">${names[i]}</a><div>Sponsored</div><div>Handcrafted solid wood furniture, sofas, dining tables, wardrobes and beds. Visit our furniture showroom for custom home furniture.</div><a href="https://m.me/FixtureShop${i}">Send message</a><a href="https://www.facebook.com/ads/library/?id=${991000000000001+i}">See ad details</a></div>`;
const about=(i,contact)=>`<html><body><main role="main"><h1>${names[i]}</h1><h2>About</h2><a href="https://shop${i}.test/Products?Color=Blue">shop${i}.test</a><a href="https://maps.google.com/?q=Dhaka">House 14, Dhaka, Bangladesh</a>${contact||i===1?`<a href="tel:${phones[i]}">Call</a><a href="mailto:sales@shop${i}.test">Email</a>`:''}</main></body></html>`;
let context;
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:chromium.executablePath(),args:['--proxy-server=http://127.0.0.1:9',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:440,height:800}});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='www.facebook.com'){
   visits.push(url.pathname+url.search);
   if(url.pathname.startsWith('/ads/library'))return route.fulfill({contentType:'text/html; charset=utf-8',body:`<html><body><main>${card(0)}${card(1)}</main></body></html>`});
   const match=url.pathname.match(/^\/FixtureShop([01])\/(about|about_contact_and_basic_info)\/?$/i);
   if(match)return route.fulfill({contentType:'text/html; charset=utf-8',body:about(Number(match[1]),match[2]!=='about')});
  }
  if(url.protocol==='chrome-extension:')return route.continue();
  return route.abort();
 });
 const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
 const origin=`chrome-extension://${new URL(worker.url()).hostname}`;
 const page=await context.newPage();
 const pageErrors=[];page.on('pageerror',err=>pageErrors.push(err.message));
 await page.goto(`${origin}/sidepanel.html`);
 const started=await page.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'START_RESEARCH',payload:{mode:'CUSTOM',keywords:['Furniture'],countryCode:'BD',locationName:'Bangladesh',maxResults:2,strictLocalMode:true}},resolve)));
 assert.equal(started.success,true);
 let result;
 for(let attempt=0;attempt<300;attempt++){
  result=await page.evaluate(async()=> (await chrome.storage.local.get('activeResearchRun')).activeResearchRun);
  if(result && ['COMPLETED','FAILED','PARTIAL','BLOCKED','CHALLENGED','RATE_LIMITED'].includes(result.status))break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 console.log(JSON.stringify({status:result?.status,counters:result?.counters,visits},null,2));
 if(result?.status!=='COMPLETED')console.log(JSON.stringify(await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('leadnoria-research');request.onsuccess=()=>{const db=request.result;const get=db.transaction('ads').objectStore('ads').getAll();get.onsuccess=()=>resolve(get.result.map(ad=>({name:ad.pageName,page:ad.facebookPageUrl,evidence:ad.businessPageEvidence})));};})),null,2));
 assert.equal(result.status,'COMPLETED');
 assert.equal(result.leads.length,2);
 for(let i=0;i<2;i++){
  const lead=result.leads.find(lead=>lead.name===names[i]);assert(lead);
  assert.equal(lead.businessWebsiteUrl,`https://shop${i}.test/Products?Color=Blue`);
  assert.equal(lead.businessEmail,`sales@shop${i}.test`);
  assert.equal(lead.businessPhone,phones[i]);
  assert.equal(lead.businessPageEvidence.status,'CHECKED');
  assert(visits.some(url=>url.toLowerCase().startsWith(`/fixtureshop${i}/about`)));
 }
 assert(visits.some(url=>url.toLowerCase().startsWith('/fixtureshop0/about_contact_and_basic_info')));
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto(`${origin}/sidepanel.html`);
 await page.getByRole('tab',{name:/^Leads/}).click();
 await page.getByRole('button',{name:'Download CSV (2)',exact:true}).waitFor();
 assert.equal(await page.getByText('Export options',{exact:true}).count(),0);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download CSV (2)',exact:true}).click()]);
 await fs.mkdir('../outputs',{recursive:true});
 await download.saveAs('../outputs/LeadNoria-five-column-mv3.csv');
 const csv=await fs.readFile('../outputs/LeadNoria-five-column-mv3.csv','utf8');
 assert.equal(csv.replace(/^\uFEFF/,'').split('\r\n')[0],'"Page name","Page URL","Website","Email","Phone"');
 assert(csv.includes('বাংলা Furniture House'));assert(csv.includes('sales@shop0.test'));
 await page.bringToFront();
 await page.getByRole('button',{name:'Copy 2 leads for Google Sheets'}).click();
 const copied=await page.evaluate(()=>navigator.clipboard.readText());
 const rows=copied.replace(/\r\n/g,'\n').split('\n').map(row=>row.split('\t'));
 assert.deepEqual(rows[0],['Page name','Page URL','Website','Email','Phone']);
 assert.equal(rows.length,3);assert(rows.every(row=>row.length===5));
 assert.equal(rows[1][3],'sales@shop0.test');assert(rows[1][4].includes('1712345678'));
 await page.reload();await page.getByRole('tab',{name:/^Leads/}).click();
 await page.getByRole('button',{name:'Download CSV (2)',exact:true}).waitFor();
 await page.screenshot({path:'../outputs/LeadNoria-five-column-mv3.png',fullPage:true});
 // A stored-data fixture tests exports beyond the 50-row summary, independently of the two-Page scrape above.
 const lastSeeded = await page.evaluate(async run => {
  const seeded=[];
  for(let i=2;i<65;i++){
   const lead=structuredClone(run.leads[0]);
   lead.id=`large-fixture-${i}`;lead.canonicalKey=`large-fixture-${i}`;lead.canonicalPageSlug=`storedfixture${i}`;
   lead.name=lead.canonicalName=lead.facebookPageName=`Stored Furniture ${i}`;
   lead.facebookPageUrl=`https://www.facebook.com/StoredFixture${i}`;
   lead.businessWebsiteUrl=`https://stored${i}.test`;lead.businessEmail=`sales@stored${i}.test`;
   lead.contactProfile.observedEmails=lead.contactProfile.observedEmails.map(item=>({...item,rawValue:lead.businessEmail,normalizedValue:lead.businessEmail,sourceUrl:lead.facebookPageUrl}));
   lead.contactProfile.primaryEmail=lead.businessEmail;
   lead.runId=run.runId;seeded.push(lead);
  }
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open('leadnoria-research');request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result;const tx=db.transaction('entities','readwrite');seeded.forEach(lead=>tx.objectStore('entities').put(lead));tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};
  });
  run.leads=[...run.leads,...seeded].slice(0,50);run.counters.finalUniqueLeads=65;run.counters.finalUniqueRelevantLeads=65;run.lastCheckpointBatch=999;
  await chrome.storage.local.set({activeResearchRun:run,researchHistory:[run]});
  return seeded.at(-1);
 },result);
 await page.reload();await page.getByRole('tab',{name:/^Leads/}).click();
 const [largeDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download CSV (65)',exact:true}).click()]);
 await largeDownload.saveAs('../outputs/LeadNoria-five-column-65-stored.csv');
 const largeCsv=await fs.readFile('../outputs/LeadNoria-five-column-65-stored.csv','utf8');
 assert.equal(largeCsv.replace(/^\uFEFF/,'').trim().split('\r\n').length,66);
 assert(largeCsv.includes('sales@stored64.test'));
 await page.getByRole('button',{name:'Copy 65 leads for Google Sheets'}).click();
 const largeCopy=await page.evaluate(()=>navigator.clipboard.readText());
 assert.equal(largeCopy.replace(/\r\n/g,'\n').split('\n').length,66);
 // A missing stored row must block a partial export. Restore it and exercise Retry.
 await page.evaluate(async lead=>new Promise((resolve,reject)=>{const request=indexedDB.open('leadnoria-research');request.onsuccess=()=>{const db=request.result;const tx=db.transaction('entities','readwrite');tx.objectStore('entities').delete([lead.runId,lead.canonicalKey]);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),lastSeeded);
 await page.reload();await page.getByRole('tab',{name:/^Leads/}).click();
 await page.getByRole('alert').filter({hasText:'full saved list could not be loaded'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download CSV (64)',exact:true}).isEnabled(),false);
 await page.evaluate(async lead=>new Promise((resolve,reject)=>{const request=indexedDB.open('leadnoria-research');request.onsuccess=()=>{const db=request.result;const tx=db.transaction('entities','readwrite');tx.objectStore('entities').put(lead);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),lastSeeded);
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.getByRole('button',{name:'Download CSV (65)',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download CSV (65)',exact:true}).isEnabled(),true);
 assert.deepEqual(pageErrors,[]);
 assert.equal(context.pages().filter(p=>p.url().startsWith('https://www.facebook.com/')).length,0);
 await fs.writeFile('../outputs/LeadNoria-mv3-workflow-report.json',JSON.stringify({scope:'Real isolated Chromium MV3 runtime; intercepted local HTML fixtures and a 65-row seeded storage fixture, not live Meta',passed:true,checks:['Content-script extraction','Every advertiser About visited','Contact-section fallback','Website/email/phone persistence','Five-column CSV download','Real clipboard Sheets paste columns','Reload persistence','Owned tab cleanup','All 65 seeded stored rows exported beyond the 50-row summary','Missing-row export block and Retry recovery'],visits,realFixturePageCount:2,seededStoredRowCount:65},null,2));
 console.log('PASS real isolated MV3 fixture workflow: content script, public Page tabs, email/phone/website, five-column CSV and clipboard, reload and cleanup. No live Meta request.');
}finally{
 await context?.close();
 assert.equal(path.dirname(path.resolve(profile)),path.resolve(os.tmpdir()));
 assert(path.basename(profile).startsWith('leadnoria-mv3-'));
 await fs.rm(profile,{recursive:true,force:true});
}
