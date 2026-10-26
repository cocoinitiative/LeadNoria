import type { BusinessPageEvidence, ScrapedAdCandidate } from './types.ts';
import { applyPublicPageEvidence, businessPageAboutUrl, interpretPublicPage, mergePublicPageEvidence, readPublicPageSnapshot } from './publicPageEvidence.ts';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function withDeadline<T>(operation:Promise<T>,ms=8000,cancelled=()=>false):Promise<T>{
  let timer:ReturnType<typeof setTimeout>;
  let poll:ReturnType<typeof setInterval>;
  return Promise.race([operation,new Promise<T>((_resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error('Page read timed out')),ms);
    poll=setInterval(()=>{if(cancelled())reject(new Error('Page checking stopped'));},100);
  })]).finally(()=>{clearTimeout(timer);clearInterval(poll);});
}
export class PublicPageResearch {
  private cache=new Map<string,BusinessPageEvidence>();
  private attempts=new Map<string,number>();
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
    let best=empty,signature='',stable=0,failures=0;
    for(let attempt=0;attempt<16 && !cancelled();attempt++){
      let result;
      try{
        result=await withDeadline(chrome.scripting.executeScript({target:{tabId},func:readPublicPageSnapshot}),8000,cancelled);
      }catch{
        if(cancelled())return best;
        if(++failures>=2)return {...best,retryable:true,reason:best.reason+' Page reading ended after two transient execution failures.'};
        await delay(500);continue;
      }
      const snapshot=result[0]?.result;
      if(snapshot?.blocked)return best.status==='CHECKED'
        ? {...best,accessRestricted:true,reason:best.reason+' An access restriction interrupted further reads; earlier observations were preserved.'}
        : interpretPublicPage(snapshot,source,name);
      if(snapshot?.heading){
        const evidence=interpretPublicPage(snapshot,source,name);
        // A navigating SPA can briefly expose the previous document/heading. Never apply it.
        if(evidence.status==='IDENTITY_MISMATCH'){
          best=best.status==='CHECKED'?best:evidence;
          await delay(500);continue;
        }
        if(evidence.status!=='CHECKED'){await delay(500);continue;}
        best=mergePublicPageEvidence(best,evidence);
        const next=JSON.stringify([evidence.websiteUrls,evidence.contacts?.map(item=>[item.type,item.normalizedValue || item.rawValue]),evidence.addressCountryCodes,evidence.addressText]);
        stable=next===signature?stable+1:0;signature=next;
        const complete=best.websiteUrls.length && best.contacts?.some(item=>item.type==='PHONE') && best.contacts?.some(item=>item.type==='EMAIL');
        if(complete && stable>=1)return best;
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
      const name=candidate.pageName || candidate.advertiserName || '';
      const key=source+'\n'+name.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();
      const cached=this.cache.get(key);
      if(cached && (this.blocked || !cached.retryable || (this.attempts.get(key)||0)>=2)){this.apply(candidate,cached);continue;}
      if(this.blocked){this.apply(candidate,{sourceUrl:source,checkedAt:new Date().toISOString(),status:'BLOCKED',websiteUrls:[],addressCountryCodes:[],reason:'Page checking stopped after an access restriction. This Page was not read.'});continue;}
      if((this.attempts.get(key)||0)>=2){this.apply(candidate,{sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'Two attempts could not read this Page during this run. No contacts were invented.'});continue;}
      let tabId:number|undefined;
      let evidence:BusinessPageEvidence=cached?{...cached,retryable:false}:{sourceUrl:source,checkedAt:new Date().toISOString(),status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'The public Page could not be read; missing contact fields remain empty.'};
      try{
        this.attempts.set(key,(this.attempts.get(key)||0)+1);
        const tab=await chrome.tabs.create({url:'about:blank',active:false});tabId=tab.id;
        if(tabId===undefined)throw new Error('No Page tab');
        await chrome.tabs.update(tabId,{url:source});
        const observed=await this.read(tabId,source,name,cancelled);
        if(observed.status==='CHECKED')evidence=mergePublicPageEvidence(evidence,observed);
        else if(evidence.status==='CHECKED'){
          evidence.retryable=true;evidence.reason+=' The retry could not recheck About; earlier observations were preserved.';
          if(observed.status==='BLOCKED'){evidence.accessRestricted=true;this.blocked=true;}
        }else evidence=observed;
        const hasPhone=evidence.contacts?.some(item=>item.type==='PHONE');
        const hasEmail=evidence.contacts?.some(item=>item.type==='EMAIL');
        if(!cancelled() && !evidence.accessRestricted && evidence.status!=='BLOCKED' && evidence.status!=='IDENTITY_MISMATCH' && (!hasPhone || !hasEmail || !evidence.websiteUrls.length) && typeof chrome.tabs.update==='function'){
          const contactUrl=new URL(source);
          if(contactUrl.pathname==='/profile.php')contactUrl.searchParams.set('sk','about_contact_and_basic_info');
          else contactUrl.pathname=contactUrl.pathname.replace(/\/about\/?$/,'/about_contact_and_basic_info');
          await chrome.tabs.update(tabId,{url:contactUrl.toString()});
          const extra=await this.read(tabId,contactUrl.toString(),name,cancelled);
          if(extra.status==='CHECKED'){
            evidence=mergePublicPageEvidence(evidence,extra);
          }else if(extra.status==='BLOCKED'){this.blocked=true;evidence.accessRestricted=true;evidence.reason+=' The additional contact section was blocked; observed fields were preserved.';}
          else {evidence.retryable=extra.status==='UNAVAILABLE';evidence.reason+=' The additional contact section was unavailable or did not match; earlier observed fields were preserved.';}
        }
      }catch{evidence.retryable=true;evidence.reason+=' Navigation or browser communication failed.';}finally{if(tabId!==undefined)await chrome.tabs.remove(tabId).catch(()=>{});}
      if(cancelled()){this.attempts.set(key,Math.max(0,(this.attempts.get(key)||1)-1));break;}
      if(evidence.status==='CHECKED' || evidence.status==='IDENTITY_MISMATCH')this.cache.set(key,evidence);
      this.apply(candidate,evidence);
      if(evidence.status==='BLOCKED' || evidence.accessRestricted)this.blocked=true;
      if(!cancelled() && !this.blocked)await delay(700);
    }
  }
}
