import assert from 'node:assert/strict';
import {PublicPageResearch} from '../src/extension/publicPageResearch.ts';
import {processBatch} from '../src/extension/bulkProcessor.ts';
import {compileResearchIntent} from '../src/extension/relevanceEngine.ts';
import {extensionLeadToResultRowViewModel} from '../src/extension/ui/viewModelMappers.ts';
import {leadResultsToCsv,leadResultsToSheets} from '../src/extension/clipboard/leadSheets.ts';
const oldChrome=globalThis.chrome,oldTimeout=globalThis.setTimeout;
let current='',created=0,closed=0,reads=0;
const candidates=Array.from({length:65},(_,i)=>({libraryId:String(992000000000001+i),pageName:`Furniture Shop ${i}`,facebookPageUrl:`https://www.facebook.com/Shop${i}`,isActive:true,bodyCopy:'Handcrafted solid wood furniture, sofas, dining tables, wardrobes and beds. Visit our furniture showroom for custom home furniture.',ctaText:'Send message',destinationUrl:`https://m.me/Shop${i}`}));
globalThis.setTimeout=(fn,_ms,...args)=>oldTimeout(fn,0,...args);
globalThis.chrome={tabs:{create:async()=>({id:++created}),update:async(_id,{url})=>{current=url;},get:async()=>({status:'complete',url:current}),remove:async()=>{closed++;}},scripting:{executeScript:async()=>{
 reads++;const index=Number(current.match(/\/Shop(\d+)/i)[1]);
 return [{result:{url:current,heading:`Furniture Shop ${index}`,blocked:false,links:[`https://shop${index}.test`],contactItems:[{type:'PHONE',value:'+8801712345678'},{type:'EMAIL',value:`sales@shop${index}.test`}],businesses:[{name:`Furniture Shop ${index}`,country:'BD',address:'House 14, Dhaka, Bangladesh'}]}}];
}}};
try{
 const reader=new PublicPageResearch();await reader.enrich(candidates,()=>false);
 assert.equal(created,65);assert.equal(closed,65);assert.equal(reads,130);
 assert(candidates.every(candidate=>candidate.businessPageEvidence.status==='CHECKED'));
 const intent=compileResearchIntent({mode:'CUSTOM',keywords:['Furniture'],targetCountryCode:'BD',strictLocalMode:true});
 const result=await processBatch(candidates,new Map(),new Set(),new Set(),{rawAds:0,normalizedCandidates:0,relevantCandidates:0,uncertainCandidates:0,notRelevantCandidates:0,duplicatesRemoved:0,finalUniqueLeads:0},{runId:'benchmark-65',countryCode:'BD',locationName:'Bangladesh',currentKeyword:'Furniture',intent,effectiveCeiling:100});

 assert.equal(result.updatedEntities.length,65);
 const rows=result.updatedEntities.map(extensionLeadToResultRowViewModel);
 const tsv=leadResultsToSheets(rows).split('\n').map(row=>row.split('\t'));
 assert.equal(tsv.length,66);assert(tsv.every(row=>row.length===5));
 assert.deepEqual(tsv[0],['Page name','Page URL','Website','Email','Phone']);
 assert.equal(tsv[65][3],'sales@shop64.test');
 assert.ok(tsv[65][4].includes('1712345678'));
 const csv=leadResultsToCsv(rows);assert(csv.includes('sales@shop64.test'));assert(!csv.includes('Ad target country'));
 await reader.enrich(candidates,()=>false);assert.equal(created,65,'Repeat ads reuse the same Page evidence');
 console.log('PASS benchmark: all 65 unique Pages visited, contacts retained through batch processing, only five CSV/Sheets columns, repeated Pages cached, all owned tabs closed. Chrome API mocks, no live Meta.');
}finally{globalThis.setTimeout=oldTimeout;if(oldChrome===undefined)delete globalThis.chrome;else globalThis.chrome=oldChrome;}
