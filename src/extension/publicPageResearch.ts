import type { BusinessPageEvidence, ScrapedAdCandidate } from './types.ts';
import { businessPageAboutUrl, interpretPublicPage, readPublicPageSnapshot } from './publicPageEvidence.ts';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export class PublicPageResearch {
  private cache=new Map<string,BusinessPageEvidence>();
  private checks=0;
  private blocked=false;
  constructor(private maxChecks=40) {}

  async enrich(candidates:ScrapedAdCandidate[], cancelled:()=>boolean):Promise<void> {
    if(typeof chrome==='undefined' || !chrome.scripting?.executeScript)return;
    for(const candidate of candidates) {
      if(cancelled() || this.blocked)break;
      const source=businessPageAboutUrl(candidate.facebookPageUrl || candidate.pageUrl);
      if(!source)continue;
      const cached=this.cache.get(source);
      if(cached){candidate.businessPageEvidence=cached;continue;}
      if(this.checks>=this.maxChecks){candidate.businessPageEvidence={sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'The bounded Page-check budget was reached. This Page was not checked; website presence remains unknown.'};continue;}
      this.checks++;
      let tabId:number|undefined;
      let evidence:BusinessPageEvidence={sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'The public Page could not be read; website presence remains unknown.'};
      try {
        const tab=await chrome.tabs.create({url:source,active:false});tabId=tab.id;
        if(tabId===undefined)throw new Error('No Page tab');
        let loaded=false;
        for(let attempt=0;attempt<12 && !cancelled();attempt++){
          const current=await chrome.tabs.get(tabId);
          if(current.status==='complete'){loaded=true;break;}
          await delay(500);
        }
        if(!loaded || cancelled())throw new Error('Page not ready');
        await delay(800);
        let snapshot;
        for(let attempt=0;attempt<3 && !cancelled();attempt++){
          const result=await chrome.scripting.executeScript({target:{tabId},func:readPublicPageSnapshot});
          snapshot=result[0]?.result;
          if(snapshot?.blocked || snapshot?.heading)break;
          await delay(500);
        }
        if(snapshot)evidence=interpretPublicPage(snapshot,source,candidate.pageName || candidate.advertiserName || '');
      }catch{}finally{
        if(tabId!==undefined)await chrome.tabs.remove(tabId).catch(()=>{});
      }
      this.cache.set(source,evidence);
      candidate.businessPageEvidence=evidence;
      if(evidence.status==='BLOCKED')this.blocked=true;
      if(!cancelled() && !this.blocked)await delay(700);
    }
  }
}
