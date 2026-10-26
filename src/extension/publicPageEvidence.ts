import type { BusinessPageEvidence, ScrapedAdCandidate } from './types.ts';
import { classifyDestination, resolveObservedDestinationUrl } from './destinationClassifier.ts';
import { META_AD_LIBRARY_LOCATIONS } from '../data/locationCatalogue.ts';
import { normalizeContactPhone, normalizeContactEmail, type ContactObservation } from './contactQuality.ts';

export interface PublicPageSnapshot {
  url: string;
  heading: string;
  blocked: boolean;
  links: string[];
  addressTexts?: string[];
  contactItems?: Array<{type:'PHONE'|'EMAIL';value:string}>;
  businesses: Array<{ name: string; url?: string; country?: string; address?: string; telephone?: string; email?: string }>;
}

/** Combine observations only after both sections independently pass Page identity checks. */
export function mergePublicPageEvidence(first:BusinessPageEvidence,next:BusinessPageEvidence):BusinessPageEvidence {
  if(next.status!=='CHECKED')return first;
  if(first.status!=='CHECKED')return next;
  if(businessPageAboutUrl(first.sourceUrl)!==businessPageAboutUrl(next.sourceUrl))return first;
  const contacts=[...(first.contacts || []),...(next.contacts || [])];
  return {...first,checkedAt:next.checkedAt,accessRestricted:first.accessRestricted || next.accessRestricted,retryable:first.retryable || next.retryable,
    contacts:[...new Map(contacts.map(item=>[`${item.type}:${item.normalizedValue || item.rawValue}:${item.sourceUrl}`,item])).values()],
    websiteUrls:[...new Set([...first.websiteUrls,...next.websiteUrls])],
    addressCountryCodes:[...new Set([...first.addressCountryCodes,...next.addressCountryCodes])],
    addressText:[...new Set([first.addressText,next.addressText].filter(Boolean))].join(' | ').slice(0,1000)||undefined,
    reason:'Matched public Page observations retained across About/contact reads. Missing fields remain unknown; website ownership and contact deliverability are unverified.'};
}

export function applyPublicPageEvidence(candidate:ScrapedAdCandidate,evidence:BusinessPageEvidence):void {
  candidate.businessPageEvidence=evidence;
  if(evidence.status!=='CHECKED')return;
  const contacts=[...(candidate.contactObservations || []),...(candidate.observedPhones || []),...(candidate.observedEmails || []),...(evidence.contacts || [])];
  candidate.contactObservations=[...new Map(contacts.map(item=>[`${item.type}:${item.sourceSurface}:${item.normalizedValue || item.rawValue}`,item])).values()];
}

export function businessPageAboutUrl(raw?: string): string | undefined {
  try {
    const url = new URL(raw || '');
    if (url.protocol !== 'https:' || !['www.facebook.com', 'web.facebook.com', 'm.facebook.com', 'facebook.com'].includes(url.hostname) || url.username || url.password) return;
    if (url.pathname === '/profile.php') {
      const id = url.searchParams.get('id');
      return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}&sk=about` : undefined;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length || ['ads','groups','events','watch','reel','reels','login','help','settings','l.php','share','sharer.php','marketplace','search','photo.php','photos','stories'].includes(parts[0].toLowerCase())) return;
    if (parts.length > 1 && !['about','about_details','about_contact_and_basic_info'].includes(parts[1])) return;
    if (!/^[\w.\-]+$/.test(parts[0])) return;
    return `https://www.facebook.com/${parts[0].toLowerCase()}/about`;
  } catch { return; }
}

const normalizeName = (name: string) => name.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
function countryCode(raw?: string): string | undefined {
  if (!raw) return;
  const text = raw.trim().toLocaleLowerCase();
  const match = META_AD_LIBRARY_LOCATIONS.find(country => [country.locationCode,country.displayName,...country.aliases].some(name=>name.toLocaleLowerCase() === text));
  return match?.locationCode;
}

export function interpretPublicPage(snapshot: PublicPageSnapshot, expectedUrl: string, expectedName: string): BusinessPageEvidence {
  const base: BusinessPageEvidence = {sourceUrl: expectedUrl, checkedAt: new Date().toISOString(), status:'UNAVAILABLE',websiteUrls:[],addressCountryCodes:[],reason:'Public Page details could not be confirmed.'};
  if (snapshot.blocked) return {...base,status:'BLOCKED',reason:'A login or access restriction prevented Page checking.'};
  if (businessPageAboutUrl(snapshot.url) !== businessPageAboutUrl(expectedUrl)) return {...base,status:'IDENTITY_MISMATCH',reason:'The Page redirected to a different identity.'};
  const observedUrl = new URL(snapshot.url);
  if (!/\/about(?:_details|_contact_and_basic_info)?\/?$/.test(observedUrl.pathname) && !/^about/.test(observedUrl.searchParams.get('sk') || '')) return {...base,reason:'The public About section was not available; posts were not used as business evidence.'};
  const expected = normalizeName(expectedName), heading=normalizeName(snapshot.heading);
  if (!expected || !heading || expected !== heading) return {...base,status:'IDENTITY_MISMATCH',reason:'The visible Page name did not match the advertiser; no Page evidence was applied.'};
  const businesses=snapshot.businesses.filter(b=>normalizeName(b.name) === expected);
  const websites=[...snapshot.links,...businesses.map(b=>b.url||'')].map(resolveObservedDestinationUrl).filter((url):url is string=>Boolean(url)).filter(url=>{
    const host=new URL(url).hostname;
    return !['meta.com','facebook.net','fbcdn.net','maps.google.com','maps.app.goo.gl'].some(domain=>host === domain || host.endsWith('.'+domain)) && !/^maps\.google\./i.test(host) && !/^https:\/\/(?:www\.)?google\.[^/]+\/maps(?:\/|\?)/i.test(url) && classifyDestination({destinationUrl:url}).destinationType === 'EXTERNAL_WEBSITE';
  });
  const visibleAddresses=(snapshot.addressTexts || []).filter(address=>address.split(/[,\n]/).length>1);
  const countries=[...new Set([...businesses.map(b=>countryCode(b.country)),...visibleAddresses.flatMap(address=>address.split(/[,\n]/).map(countryCode))].filter((code):code is string=>Boolean(code)))];
  const items=[...(snapshot.contactItems || []),...businesses.flatMap(b=>[...(b.telephone?[{type:'PHONE' as const,value:b.telephone}]:[]),...(b.email?[{type:'EMAIL' as const,value:b.email}]:[])])];
  const seen=new Set<string>();
  const contacts:ContactObservation[]=[];
  for(const item of items.slice(0,100)){
    if(!item.value || item.value.length>150)continue;
    const normalized=item.type==='PHONE'?normalizeContactPhone(item.value,countries.length===1?countries[0]:undefined):normalizeContactEmail(item.value);
    if(normalized.syntaxState!=='SYNTAX_VALID' && normalized.syntaxState!=='AMBIGUOUS')continue;
    const key=`${item.type}:${normalized.normalized || item.value}`;
    if(seen.has(key))continue;seen.add(key);
    contacts.push({id:`page_${item.type}_${contacts.length+1}_${expectedUrl}`,type:item.type,rawValue:item.value,normalizedValue:normalized.normalized,sourceSurface:'FACEBOOK_PAGE_ABOUT',sourceUrl:expectedUrl,syntaxState:normalized.syntaxState,verificationStatus:'UNPROBED_PUBLIC_CLAIM',confidence:normalized.syntaxState==='SYNTAX_VALID'?'HIGH':'MEDIUM',contextSnippet:'Published in the matched business Page About details.',observedAt:base.checkedAt,evidenceReason:normalized.reason});
  }
  return {...base,status:'CHECKED',contacts,websiteUrls:[...new Set(websites)].slice(0,5),addressCountryCodes:countries,addressText:[...businesses.map(b=>b.address),...visibleAddresses].filter(Boolean).join(' | ').slice(0,1000)||undefined,reason:websites.length?'External website link observed on the matched public Page. Reachability and ownership are unverified.':'No website link was observed in the checked Page details. This does not prove the business has no website.'};
}

/** Serialized into an owned Page tab. Reads public About content; does not click or bypass access restrictions. */
export function readPublicPageSnapshot(): PublicPageSnapshot {
  const visibility={test(element:Element){return element.getClientRects().length>0 && (element.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true}) ?? getComputedStyle(element).visibility!=='hidden');}};
  const excluded='[role=article],article,nav,[role=navigation],form';
  const main = Array.from(document.querySelectorAll('[role=main],main')).find(visibility.test);
  const heading = Array.from(main?.querySelectorAll('h1,[role=heading][aria-level="1"]') || []).find(visibility.test)?.textContent?.trim() || '';
  const text=(main?.textContent || '').slice(0,12000);
  const loginOverlay=Array.from(document.querySelectorAll('[role=dialog] input[type=password]')).some(visibility.test);
  const blocked=loginOverlay || /\/login|checkpoint|challenge/i.test(location.pathname) || /^(log (?:in|into)|login|লগ ইন)/i.test(heading) || (!heading && /log in|login|captcha|temporarily blocked|rate limit|লগ ইন/i.test(text));
  const links: string[]=[];
  const addressTexts:string[]=[];
  const contactItems:NonNullable<PublicPageSnapshot['contactItems']>=[];
  if (main && !blocked) {
    for (const anchor of Array.from(main.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const label=(anchor.textContent || '').trim();
      if(anchor.closest(excluded) || !visibility.test(anchor))continue;
      if(/^(tel:|mailto:)/i.test(anchor.href)){
        try { const type=anchor.href.toLowerCase().startsWith('tel:')?'PHONE':'EMAIL';const value=decodeURIComponent(anchor.href.slice(type==='PHONE'?4:7).split('?')[0]);contactItems.push({type,value}); }catch{}
        continue;
      }
      let addressHref=anchor.href;
      try { const url=new URL(addressHref); if(url.pathname==='/l.php')addressHref=url.searchParams.get('u') || addressHref; } catch {}
      if(!anchor.closest('[role=article]') && anchor.getClientRects().length && /maps\.google\.|google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(addressHref)){if(label)addressTexts.push(label.slice(0,500));continue;}
      if (!anchor.closest('[role=article]') && anchor.getClientRects().length && (/^https?:|^www\.|\.[a-z]{2,}(?:\/|$)/i.test(label) || /website|visit site|ওয়েবসাইট/i.test(anchor.getAttribute('aria-label') || '') || /\/l\.php\?/.test(anchor.href))) links.push(anchor.href);
    }
    for(const element of Array.from(main.querySelectorAll<HTMLElement>('span,[dir=auto],p,li,dd'))){
      if(element.children.length || !visibility.test(element) || element.closest(excluded))continue;
      const value=(element.innerText || '').trim().replace(/^(?:email|e-mail|phone|telephone|mobile|ইমেইল|ফোন|মোবাইল)\s*[:：]\s*/i,'');
      if(value.length>150)continue;
      if(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value))contactItems.push({type:'EMAIL',value});
      else {
        const digits=value.normalize('NFKC').replace(/[০-৯०-९٠-٩۰-۹]/g,digit=>{const code=digit.charCodeAt(0);return String(code-(code>=0x09e6?0x09e6:code>=0x0966?0x0966:code>=0x06f0?0x06f0:0x0660));});
        if(/^(?:\+[\d ().-]{7,24}|0\d{8,12}|\(?\d{2,4}\)?[ -]\d[\d ().-]{5,22})$/.test(digits))contactItems.push({type:'PHONE',value});
      }
    }
  }
  const businesses: PublicPageSnapshot['businesses']=[];
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0,10)) {
    try {
      const root=JSON.parse(script.textContent || 'null');
      const queue=Array.isArray(root)?root:[root];
      for(let i=0;i<queue.length && i<50;i++) {
        const node=queue[i];if(!node || typeof node !== 'object')continue;
        if(Array.isArray(node['@graph']))queue.push(...node['@graph']);
        const types=Array.isArray(node['@type'])?node['@type']:[node['@type']];
        if(!types.some(type=>typeof type==='string' && /^(LocalBusiness|Organization|Store|FurnitureStore|Restaurant|ProfessionalService|MedicalBusiness|LodgingBusiness)$/.test(type)))continue;
        const address=node.address;
        const country=typeof address?.addressCountry==='string'?address.addressCountry:address?.addressCountry?.name;
        businesses.push({name:typeof node.name==='string'?node.name:'',url:typeof node.url==='string'?node.url:undefined,country:typeof country==='string'?country:undefined,address:address && typeof address==='object'?[address.streetAddress,address.addressLocality,address.addressRegion,address.postalCode,country].filter(v=>typeof v==='string').join(', '):undefined,telephone:typeof node.telephone==='string'?node.telephone:undefined,email:typeof node.email==='string'?node.email:undefined});
      }
    }catch{}
  }
  return {url:location.href,heading,blocked,links:links.slice(0,50),businesses,addressTexts:addressTexts.slice(0,5),contactItems:contactItems.slice(0,100)};
}
