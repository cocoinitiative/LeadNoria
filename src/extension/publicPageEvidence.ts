import type { BusinessPageEvidence } from './types.ts';
import { classifyDestination, resolveObservedDestinationUrl } from './destinationClassifier.ts';
import { META_AD_LIBRARY_LOCATIONS } from '../data/locationCatalogue.ts';

export interface PublicPageSnapshot {
  url: string;
  heading: string;
  blocked: boolean;
  links: string[];
  addressTexts?: string[];
  businesses: Array<{ name: string; url?: string; country?: string; address?: string }>;
}

export function businessPageAboutUrl(raw?: string): string | undefined {
  try {
    const url = new URL(raw || '');
    if (url.protocol !== 'https:' || !['www.facebook.com', 'web.facebook.com', 'facebook.com'].includes(url.hostname) || url.username || url.password) return;
    if (url.pathname === '/profile.php') {
      const id = url.searchParams.get('id');
      return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}&sk=about` : undefined;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length || ['ads','groups','events','watch','reel','reels','login','help','settings','l.php','share','sharer.php','marketplace','search','photo.php','photos','stories'].includes(parts[0].toLowerCase())) return;
    if (parts.length > 1 && !['about','about_details'].includes(parts[1])) return;
    if (!/^[\w.\-]+$/.test(parts[0])) return;
    return `https://www.facebook.com/${parts[0]}/about`;
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
  if (!/\/about(?:_details)?\/?$/.test(observedUrl.pathname) && !/^about/.test(observedUrl.searchParams.get('sk') || '')) return {...base,reason:'The public About section was not available; posts were not used as business evidence.'};
  const expected = normalizeName(expectedName), heading=normalizeName(snapshot.heading);
  if (!expected || !heading || expected !== heading) return {...base,status:'IDENTITY_MISMATCH',reason:'The visible Page name did not match the advertiser; no Page evidence was applied.'};
  const businesses=snapshot.businesses.filter(b=>normalizeName(b.name) === expected);
  const websites=[...snapshot.links,...businesses.map(b=>b.url||'')].map(resolveObservedDestinationUrl).filter((url):url is string=>Boolean(url)).filter(url=>{
    const host=new URL(url).hostname;
    return !['meta.com','facebook.net','fbcdn.net','maps.google.com','maps.app.goo.gl'].some(domain=>host === domain || host.endsWith('.'+domain)) && !/^maps\.google\./i.test(host) && !/^https:\/\/(?:www\.)?google\.[^/]+\/maps(?:\/|\?)/i.test(url) && classifyDestination({destinationUrl:url}).destinationType === 'EXTERNAL_WEBSITE';
  });
  const visibleAddresses=(snapshot.addressTexts || []).filter(address=>address.split(/[,\n]/).length>1);
  const countries=[...new Set([...businesses.map(b=>countryCode(b.country)),...visibleAddresses.flatMap(address=>address.split(/[,\n]/).map(countryCode))].filter((code):code is string=>Boolean(code)))];
  return {...base,status:'CHECKED',websiteUrls:[...new Set(websites)].slice(0,5),addressCountryCodes:countries,addressText:[...businesses.map(b=>b.address),...visibleAddresses].filter(Boolean).join(' | ').slice(0,1000)||undefined,reason:websites.length?'External website link observed on the matched public Page. Reachability and ownership are unverified.':'No website link was observed in the checked Page details. This does not prove the business has no website.'};
}

/** Serialized into an owned Page tab. Reads public About content; does not click or bypass access restrictions. */
export function readPublicPageSnapshot(): PublicPageSnapshot {
  const main = document.querySelector('[role=main]') || document.querySelector('main');
  const heading = main?.querySelector('h1,[role=heading][aria-level="1"]')?.textContent?.trim() || '';
  const text=(main?.textContent || '').slice(0,12000);
  const blocked=/\/login|checkpoint|challenge/i.test(location.pathname) || /^(log (?:in|into)|login|লগ ইন)/i.test(heading) || (!heading && /log in|login|captcha|temporarily blocked|rate limit|লগ ইন/i.test(text));
  const links: string[]=[];
  const addressTexts:string[]=[];
  if (main && !blocked) {
    for (const anchor of Array.from(main.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
      const label=(anchor.textContent || '').trim();
      let addressHref=anchor.href;
      try { const url=new URL(addressHref); if(url.pathname==='/l.php')addressHref=url.searchParams.get('u') || addressHref; } catch {}
      if(!anchor.closest('[role=article]') && anchor.getClientRects().length && /maps\.google\.|google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(addressHref)){if(label)addressTexts.push(label.slice(0,500));continue;}
      if (!anchor.closest('[role=article]') && anchor.getClientRects().length && (/^https?:|^www\.|\.[a-z]{2,}(?:\/|$)/i.test(label) || /website|visit site|ওয়েবসাইট/i.test(anchor.getAttribute('aria-label') || '') || /\/l\.php\?/.test(anchor.href))) links.push(anchor.href);
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
        businesses.push({name:typeof node.name==='string'?node.name:'',url:typeof node.url==='string'?node.url:undefined,country:typeof country==='string'?country:undefined,address:address && typeof address==='object'?[address.streetAddress,address.addressLocality,address.addressRegion,address.postalCode,country].filter(v=>typeof v==='string').join(', '):undefined});
      }
    }catch{}
  }
  return {url:location.href,heading,blocked,links:links.slice(0,50),businesses,addressTexts:addressTexts.slice(0,5)};
}
