import assert from 'node:assert/strict';
import {PublicPageResearch} from '../src/extension/publicPageResearch.ts';
import {normalizeContactPhone} from '../src/extension/contactQuality.ts';
import {businessPageAboutUrl} from '../src/extension/publicPageEvidence.ts';

const oldChrome=globalThis.chrome,oldTimeout=globalThis.setTimeout;
globalThis.setTimeout=(fn,_ms,...args)=>oldTimeout(fn,0,...args);
let current='',created=0,closed=0,read=0;
const candidate=(name='Furniture Test')=>({libraryId:String(Math.random()),pageName:name,facebookPageUrl:'https://www.facebook.com/FixtureTest'});
const snapshot=(extra={})=>({url:current,heading:'Furniture Test',blocked:false,links:['https://fixture.test'],businesses:[],contactItems:[{type:'PHONE',value:'+8801712345678'},{type:'EMAIL',value:'sales@fixture.test'}],...extra});
const install=(reader,update)=>{
 current='';created=closed=read=0;
 globalThis.chrome={tabs:{create:async()=>({id:++created}),update:async(_id,{url})=>{current=url;await update?.();},get:async()=>({status:'complete',url:current}),remove:async()=>{closed++;}},scripting:{executeScript:async()=>{read++;return [{result:await reader(read)}];}}};
};
try{
 // Contacts can arrive well after load and earlier observations can disappear from the DOM.
 install(n=>snapshot(n<10?{contactItems:[]}:n===10?{links:[],contactItems:[{type:'PHONE',value:'+8801712345678'}]}:{links:[],contactItems:[{type:'EMAIL',value:'sales@fixture.test'}]}));
 const delayed=candidate();await new PublicPageResearch().enrich([delayed],()=>false);
 assert(read>=11);assert.deepEqual(delayed.businessPageEvidence.websiteUrls,['https://fixture.test/']);
 assert.equal(new Set(delayed.businessPageEvidence.contacts.map(c=>c.type)).size,2);
 assert.equal(created,closed);

 // A stale SPA name is never used, but the correct heading may replace it on the next poll.
 install(n=>snapshot(n===1?{heading:'Previous Page',contactItems:[{type:'EMAIL',value:'wrong@other.test'}]}:{}));
 const stale=candidate();await new PublicPageResearch().enrich([stale],()=>false);
 assert.equal(stale.businessPageEvidence.status,'CHECKED');assert(!JSON.stringify(stale).includes('wrong@other'));

 install(n=>{if(n===1)throw Error('Execution context destroyed');return snapshot();});
 const transient=candidate();await new PublicPageResearch().enrich([transient],()=>false);
 assert.equal(transient.businessPageEvidence.status,'CHECKED');assert.equal(created,1);

 // A failed visit must not poison the cache. Retry is bounded to two visits per identity.
 let fail=true;install(()=>snapshot(),()=>{if(fail)throw Error('Temporary tab navigation failure');});
 const retryReader=new PublicPageResearch(),first=candidate();await retryReader.enrich([first],()=>false);
 assert.equal(first.businessPageEvidence.status,'UNAVAILABLE');fail=false;
 const retry=candidate();await retryReader.enrich([retry],()=>false);assert.equal(retry.businessPageEvidence.status,'CHECKED');
 await retryReader.enrich([candidate()],()=>false);assert.equal(created,2);assert.equal(created,closed);
 const differentName=candidate('Different Advertiser');await retryReader.enrich([differentName],()=>false);
 assert.equal(differentName.businessPageEvidence.status,'IDENTITY_MISMATCH');assert(!differentName.contactObservations);

 let contactFailed=true;
 install(()=>snapshot(contactFailed?{contactItems:[]}:{}),()=>{if(contactFailed && current.includes('about_contact'))throw Error('Contact section navigation failed');});
 const partialReader=new PublicPageResearch(),partial=candidate();await partialReader.enrich([partial],()=>false);
 assert.equal(partial.businessPageEvidence.status,'CHECKED');assert.equal(partial.businessPageEvidence.retryable,true);
 contactFailed=false;const repaired=candidate();await partialReader.enrich([repaired],()=>false);
 assert.equal(repaired.businessPageEvidence.contacts.length,2);assert(!repaired.businessPageEvidence.retryable);
 await partialReader.enrich([candidate()],()=>false);assert.equal(created,2);

 install(()=>snapshot(),()=>{throw Error('Always unavailable');});
 const bounded=new PublicPageResearch();for(let i=0;i<3;i++)await bounded.enrich([candidate()],()=>false);
 assert.equal(created,2);assert.equal(closed,2);

 // Cancellation neither consumes retry budget nor caches a half-read Page.
 let stopped=false;install(()=>{stopped=true;return snapshot();});
 const cancelled=candidate(),cancelReader=new PublicPageResearch();await cancelReader.enrich([cancelled],()=>stopped);
 assert.equal(cancelled.businessPageEvidence,undefined);assert.equal(created,closed);
 stopped=false;globalThis.chrome.scripting.executeScript=async()=>[{result:snapshot()}];
 const resumed=candidate();await cancelReader.enrich([resumed],()=>false);assert.equal(resumed.businessPageEvidence.status,'CHECKED');

 install(n=>snapshot(n===1?{contactItems:[]}:{blocked:true}));
 const restrictedReader=new PublicPageResearch(),before=candidate(),after={...candidate(),facebookPageUrl:'https://www.facebook.com/Unvisited'};
 await restrictedReader.enrich([before,after],()=>false);
 assert.equal(before.businessPageEvidence.status,'CHECKED');assert.equal(before.businessPageEvidence.accessRestricted,true);
 assert.equal(before.businessPageEvidence.websiteUrls.length,1);assert.equal(after.businessPageEvidence.status,'BLOCKED');assert.equal(created,1);

 assert.equal(businessPageAboutUrl('https://m.facebook.com/FixtureTest'),'https://www.facebook.com/fixturetest/about');
 for(const number of ['+৮৮০১৭১২৩৪৫৬৭৮','+८८०१७१२३४५६७८','+٨٨٠١٧١٢٣٤٥٦٧٨','+۸۸۰۱۷۱۲۳۴۵۶۷۸','＋８８０１７１２３４５６７８'])assert.equal(normalizeContactPhone(number).normalized,'+8801712345678');
 console.log('PASS Page resilience: late/disappearing contacts, stale headings, transient script/navigation errors, bounded retry, cache identity, cancellation, restriction preservation and international digits. Chrome mocks only.');
}finally{globalThis.setTimeout=oldTimeout;if(oldChrome===undefined)delete globalThis.chrome;else globalThis.chrome=oldChrome;}
