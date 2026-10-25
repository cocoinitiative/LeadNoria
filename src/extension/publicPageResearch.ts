import type { BusinessPageEvidence, ScrapedAdCandidate } from './types.ts';
import { applyPublicPageEvidence, businessPageAboutUrl, interpretPublicPage, readPublicPageSnapshot } from './publicPageEvidence.ts';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function withDeadline<T>(operation:Promise<T>,ms=8000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  return Promise.race([operation,new Promise<T>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('Page read timed out')),ms);})]).finally(()=>clearTimeout(timer));
}
export class PublicPageResearch {
  private cache=new Map<string,BusinessPageEvidence>();
  private blocked=false;

  private apply(candidate:ScrapedAdCandidate,evidence:BusinessPageEvidence){
    applyPublicPageEvidence(candidate,evidence);
  }

  private async read(tabId:number,source:string,name:string,cancelled:()=>boolean):Promise<BusinessPageEvidence>{
    const empty:BusinessPageEvidence={sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'The public Page details could not be read. Missing contact fields remain empty.'};
    let loaded=false;
    for(let attempt=0;attempt<16 && !cancelled();attempt++){
      const tab=await chrome.tabs.get(tabId);
      if(tab.status==='complete' && tab.url!=='about:blank'){loaded=true;break;}
      await delay(500);
    }
    if(!loaded || cancelled())return empty;
    await delay(800);
    let best=empty,signature='',stable=0;
    for(let attempt=0;attempt<8 && !cancelled();attempt++){
      const result=await withDeadline(chrome.scripting.executeScript({target:{tabId},func:readPublicPageSnapshot}));
      const snapshot=result[0]?.result;
      if(snapshot?.blocked)return interpretPublicPage(snapshot,source,name);
      if(snapshot?.heading){
        const evidence=interpretPublicPage(snapshot,source,name);
        if(evidence.status==='IDENTITY_MISMATCH')return evidence;
        best=evidence;
        const next=JSON.stringify([evidence.websiteUrls,evidence.contacts?.map(item=>[item.type,item.normalizedValue || item.rawValue]),evidence.addressCountryCodes,evidence.addressText]);
        stable=next===signature?stable+1:0;signature=next;
        const complete=evidence.websiteUrls.length && evidence.contacts?.some(item=>item.type==='PHONE') && evidence.contacts?.some(item=>item.type==='EMAIL');
        if((complete && stable>=1) || (attempt>=3 && stable>=2 && (evidence.websiteUrls.length || evidence.contacts?.length)))return evidence;
      }
      await delay(500);
    }
    return best;
  }

  async enrich(candidates:ScrapedAdCandidate[],cancelled:()=>boolean):Promise<void>{
    if(typeof chrome==='undefined' || !chrome.scripting?.executeScript)return;
    for(const candidate of candidates){
      if(cancelled())break;
      const id=candidate.facebookPageId || candidate.pageId;
      const raw=candidate.facebookPageUrl || candidate.pageUrl || (id && /^\d+$/.test(id)?`https://www.facebook.com/profile.php?id=${id}`:undefined);
      const source=businessPageAboutUrl(raw);
      if(!source){candidate.businessPageEvidence={sourceUrl:'',checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'No usable advertiser Page URL or numeric Page ID was observed. No Page data was invented.'};continue;}
      if(!candidate.facebookPageUrl)candidate.facebookPageUrl=raw;
      const cached=this.cache.get(source);
      if(cached){this.apply(candidate,cached);continue;}
      if(this.blocked){this.apply(candidate,{sourceUrl:source,checkedAt:new Date().toISOString(),status:'BLOCKED',websiteUrls:[],addressCountryCodes:[],reason:'Page checking stopped after an access restriction. This Page was not read.'});continue;}
      let tabId:number|undefined;
      let evidence:BusinessPageEvidence={sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'The public Page could not be read; missing contact fields remain empty.'};
      try{
        const tab=await chrome.tabs.create({url:'about:blank',active:false});tabId=tab.id;
        if(tabId===undefined)throw new Error('No Page tab');
        await chrome.tabs.update(tabId,{url:source});
        const name=candidate.pageName || candidate.advertiserName || '';
        evidence=await this.read(tabId,source,name,cancelled);
        const hasPhone=evidence.contacts?.some(item=>item.type==='PHONE');
        const hasEmail=evidence.contacts?.some(item=>item.type==='EMAIL');
        if(!cancelled() && evidence.status!=='BLOCKED' && evidence.status!=='IDENTITY_MISMATCH' && (!hasPhone || !hasEmail || !evidence.websiteUrls.length) && typeof chrome.tabs.update==='function'){
          const contactUrl=new URL(source);
          if(contactUrl.pathname==='/profile.php')contactUrl.searchParams.set('sk','about_contact_and_basic_info');
          else contactUrl.pathname=contactUrl.pathname.replace(/\/about\/?$/,'/about_contact_and_basic_info');
          await chrome.tabs.update(tabId,{url:contactUrl.toString()});
          const extra=await this.read(tabId,contactUrl.toString(),name,cancelled);
          if(extra.status==='CHECKED'){
            if(evidence.status!=='CHECKED')evidence=extra;
            else evidence={...evidence,websiteUrls:[...new Set([...evidence.websiteUrls,...extra.websiteUrls])],addressCountryCodes:[...new Set([...evidence.addressCountryCodes,...extra.addressCountryCodes])],addressText:[evidence.addressText,extra.addressText].filter(Boolean).join(' | ')||undefined,contacts:[...(evidence.contacts||[]),...(extra.contacts||[])],reason:'Public About and contact sections checked. Only observed business fields were retained; missing fields remain unknown.'};
          }else if(extra.status==='BLOCKED'){this.blocked=true;evidence.reason+=' The additional contact section was blocked; observed fields were preserved.';}
        }
      }catch{}finally{if(tabId!==undefined)await chrome.tabs.remove(tabId).catch(()=>{});}
      this.cache.set(source,evidence);this.apply(candidate,evidence);
      if(evidence.status==='BLOCKED')this.blocked=true;
      if(!cancelled() && !this.blocked)await delay(700);
    }
  }
}
