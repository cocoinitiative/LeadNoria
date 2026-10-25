import { classifyDestination, resolveObservedDestinationUrl } from './destinationClassifier.ts';
import type { ExtensionResearchRun } from './types.ts';

/** Conservative, local-only identity hints. Names and phone numbers alone never match. */
export function businessHistoryKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const lead = value as Record<string, any>;
  const keys: string[] = [];
  if (typeof lead.pageId === 'string' && /^\d+$/.test(lead.pageId)) keys.push(`page:${lead.pageId}`);
  const pageUrl = resolveObservedDestinationUrl(lead.facebookPageUrl);
  if (pageUrl) {
    const page = new URL(pageUrl);
    if (page.hostname === 'facebook.com' || page.hostname.endsWith('.facebook.com')) {
      const id = page.searchParams.get('id');
      if (page.pathname === '/profile.php' && id && /^\d+$/.test(id)) keys.push(`page:${id}`);
      else if (/^\/@?[^/]+\/?$/.test(page.pathname) && !/^\/(?:ads|share|watch|reel|groups|marketplace|login|l\.php|profile\.php)\/?$/i.test(page.pathname)) {
        keys.push(`page-url:${page.pathname.replace(/\/$/, '').toLowerCase()}`);
      }
    }
  }
  const raw = lead.destinationUrl || lead.websiteUrl;
  const name = String(lead.name || lead.advertiserName || lead.displayName || '').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, ' ').trim();
  if (name && classifyDestination({ destinationUrl: raw }).destinationType === 'EXTERNAL_WEBSITE') {
    const url = new URL(resolveObservedDestinationUrl(raw)!);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    // A shared marketplace link does not identify the advertiser's business.
    if (!['amazon.com', 'daraz.com.bd', 'ebay.com', 'etsy.com', 'aliexpress.com', 'othoba.com', 'linktr.ee'].some(domain => host === domain || host.endsWith(`.${domain}`))) {
      keys.push(`site-name:${host}|${name}`);
    }
  }
  return [...new Set(keys)];
}

export function previouslySeenBusinessKeys(runs: ExtensionResearchRun[], current?: ExtensionResearchRun | null): Set<string> {
  if (!current) return new Set();
  const at = Date.parse(current.startedAt);
  if (!Number.isFinite(at)) return new Set();
  return new Set(runs.filter(run => run.runId !== current.runId && Date.parse(run.startedAt) < at)
    .flatMap(run => (run.leads || []).flatMap(businessHistoryKeys)));
}

export function isNewToSavedLists(value: unknown, seen: ReadonlySet<string>): boolean {
  const keys = businessHistoryKeys(value);
  return keys.length > 0 && !keys.some(key => seen.has(key));
}
