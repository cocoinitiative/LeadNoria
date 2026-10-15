/**
 * LeadNoria Entity Resolution & Advanced Deduplication Engine (v1.1)
 *
 * Implements deterministic multi-signal entity identity resolution:
 * "ONE REAL BUSINESS → ONE FINAL ENTITY"
 *
 * Core Identity Invariants:
 * 1. Facebook-Page-First Precedence (Page ID > Page Slug).
 * 2. Shared Marketplace Protection (Amazon/Etsy/Daraz domain match alone NEVER merges).
 * 3. Parent Brand vs Local Branch distinction (Branch names kept separate without identical Page).
 * 4. Generic Short Name Protection (Apex, Nova, Home alone NEVER merged without corroboration).
 * 5. Full Evidence & Provenance Preservation (adLibraryIds, matchedQueries, domains, URLs).
 * 6. Deterministic, explainable merge audit trails.
 */

import type {
  ExtensionLead,
  ScrapedAdCandidate,
  IdentityConfidence,
  EntityRelationshipType,
  EntityMergeRecord,
  AdLevelEvidence
} from './types.ts';
import { sanitizeAdLibraryIds } from './metaAdapter.ts';
import { evaluateGeographicOrigin } from './geographicClassifier.ts';
import { classifyCta, classifyDestination, aggregateAdEvidence } from './destinationClassifier.ts';
import { mergeContactObservations } from './contactQuality.ts';
import { calculateLeadScore } from './leadPrioritizer.ts';

// Generic shorteners, shared hosting, and multi-tenant marketplace platforms
// Domains in this set MUST NEVER act as sole identity anchors for entity merging
export const GENERIC_SHARED_DOMAINS = new Set([
  'facebook.com', 'web.facebook.com', 'm.facebook.com', 'l.facebook.com',
  'instagram.com', 'wa.me', 'api.whatsapp.com', 'whatsapp.com',
  't.me', 'telegram.me', 'youtube.com', 'youtu.be',
  'linktr.ee', 'bio.link', 'beacons.ai', 'campsite.bio',
  'forms.gle', 'docs.google.com', 'drive.google.com', 'google.com',
  'typeform.com', 'calendly.com',
  'bit.ly', 'tinyurl.com', 'ow.ly', 'rebrand.ly', 't.co',
  'amazon.com', 'amazon.co.uk', 'amazon.in', 'amazon.de',
  'ebay.com', 'etsy.com', 'daraz.com.bd', 'daraz.pk', 'daraz.lk',
  'walmart.com', 'target.com', 'aliexpress.com', 'alibaba.com',
  'myshopify.com', 'shopee.com', 'lazada.com'
]);

// Short generic brand words that require strong corroborating evidence before merge
export const SHORT_GENERIC_BRAND_TOKENS = new Set([
  'apex', 'nova', 'home', 'design', 'elite', 'furniture', 'store', 'shop',
  'studio', 'center', 'mart', 'market', 'group', 'house', 'city', 'star',
  'royal', 'classic', 'modern', 'prime', 'best', 'super', 'mega', 'global'
]);

// Common legal and commercial suffixes stripped during comparison normalization
const LEGAL_SUFFIXES = [
  'private limited', 'pvt ltd', 'pte ltd',
  'llc', 'l.l.c.', 'inc', 'inc.', 'incorporated', 'corp', 'corp.', 'corporation',
  'ltd', 'ltd.', 'limited', 'gmbh', 'co', 'co.', 'company', 'pvt', 'pvt.', 'pte', 'private',
  'enterprises', 'holdings', 'group'
];

export interface NormalizedPageIdentity {
  rawUrl?: string;
  canonicalUrl?: string;
  pageId?: string;
  pageSlug?: string;
}

export interface NormalizedDomainIdentity {
  canonicalDomain?: string;
  isSharedMarketplace: boolean;
  cleanUrl?: string;
}

export type DuplicateMatchLevel =
  | 'EXACT_DUPLICATE'
  | 'PROBABLE_DUPLICATE'
  | 'DISTINCT_ADVERTISER'
  | 'UNKNOWN_IDENTITY';

export interface DuplicateRelationshipResult {
  matchLevel: DuplicateMatchLevel;
  confidence: IdentityConfidence;
  reason: string;
}

export interface EntityMergeDecision {
  shouldMerge: boolean;
  targetKey: string;
  confidence: IdentityConfidence;
  reason: string;
  relationshipType: EntityRelationshipType;
  matchLevel?: DuplicateMatchLevel;
}

/**
 * Normalizes an advertiser display name:
 * Strips sponsorship tags, trailing metadata, repeated punctuation, zero-width characters, and extra whitespace.
 * Applies Unicode NFKC normalization.
 */
export function normalizeAdvertiserName(rawName?: string): string {
  let name = (rawName || '').trim();
  if (!name || name === 'Unknown Advertiser') return 'Unknown Advertiser';

  // Strip zero-width characters and invisible joiners
  name = name.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Strip trailing boilerplate
  name = name.replace(/\s*·\s*Sponsored.*$/i, '');
  name = name.replace(/\s*Sponsored.*$/i, '');
  name = name.replace(/\s+page$/i, '');
  name = name.replace(/\s*\(official\)$/i, '');
  name = name.replace(/\s*\(verified\)$/i, '');
  name = name.normalize('NFKC');
  name = name.replace(/\s+/g, ' ');

  return name.trim();
}

/**
 * Strips legal entity suffixes iteratively for comparison purposes.
 */
export function getComparisonNameKey(name: string): string {
  let clean = normalizeAdvertiserName(name)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let prev = '';
  while (prev !== clean) {
    prev = clean;
    for (const s of LEGAL_SUFFIXES) {
      const regex = new RegExp(`\\b${s}\\b$`, 'i');
      clean = clean.replace(regex, '').trim();
    }
  }

  return clean;
}

/**
 * Detects whether a name is a short generic token.
 */
export function isShortGenericName(name: string): boolean {
  const comp = getComparisonNameKey(name);
  if (!comp || comp.length <= 4) return true;
  const tokens = comp.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && SHORT_GENERIC_BRAND_TOKENS.has(tokens[0])) {
    return true;
  }
  return false;
}

/**
 * Detects branch / location qualifier in an advertiser name:
 * e.g. "ABC Furniture Dhaka" vs "ABC Furniture"
 */
export function detectBranchRelationship(
  nameA: string,
  nameB: string,
  precomputedA?: string,
  precomputedB?: string
): { isBranchVariant: boolean; baseBrand?: string } {
  const a = precomputedA !== undefined ? precomputedA : getComparisonNameKey(nameA);
  const b = precomputedB !== undefined ? precomputedB : getComparisonNameKey(nameB);

  if (!a || !b || a === b) return { isBranchVariant: false };
  if (a[0] !== b[0]) return { isBranchVariant: false };

  if (a.startsWith(b) && a.length > b.length) {
    return { isBranchVariant: true, baseBrand: b };
  }
  if (b.startsWith(a) && b.length > a.length) {
    return { isBranchVariant: true, baseBrand: a };
  }

  return { isBranchVariant: false };
}

/**
 * Normalizes Facebook Page URL and extracts Page ID and canonical username slug.
 */
export function normalizeFacebookPage(rawUrl?: string, explicitPageId?: string): NormalizedPageIdentity {
  if (!rawUrl && !explicitPageId) {
    return {};
  }

  let pageId = explicitPageId?.trim();
  let pageSlug: string | undefined;
  let canonicalUrl: string | undefined;

  if (rawUrl) {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);

      // Check numeric id in query parameter (e.g. ?id=123456789)
      const qId = u.searchParams.get('id');
      if (qId && /^\d+$/.test(qId)) {
        pageId = pageId || qId;
      }

      // Check path segments
      const segments = u.pathname.split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (segments.length > 0) {
        const first = segments[0];
        if (first === 'profile.php') {
          // Handled via searchParams ?id=
        } else if (first === 'pages' && segments.length >= 2) {
          pageSlug = segments[1];
          const possibleId = segments[2];
          if (possibleId && /^\d+$/.test(possibleId)) {
            pageId = pageId || possibleId;
          }
        } else if (!['ads', 'events', 'groups', 'help', 'marketplace'].includes(first)) {
          pageSlug = first;
          if (/^\d+$/.test(first)) {
            pageId = pageId || first;
          }
        }
      }
    } catch {
      // Fall back if malformed URL
      pageSlug = rawUrl.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  if (pageSlug) {
    canonicalUrl = `https://www.facebook.com/${pageSlug}/`;
  } else if (pageId) {
    canonicalUrl = `https://www.facebook.com/${pageId}/`;
  }

  return {
    rawUrl,
    canonicalUrl,
    pageId,
    pageSlug
  };
}

/**
 * Normalizes destination URL and extracts clean canonical domain.
 * Decodes Meta link shims and strips tracking parameters.
 */
export function normalizeDestinationDomain(rawUrl?: string, rawDomain?: string): NormalizedDomainIdentity {
  let targetUrl = (rawUrl || '').trim();

  // Decode Meta link shim if present: l.facebook.com/l.php?u=...
  if (targetUrl.includes('facebook.com/l.php')) {
    try {
      const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      const shimmed = parsed.searchParams.get('u');
      if (shimmed) {
        targetUrl = decodeURIComponent(shimmed);
      }
    } catch {}
  }

  let canonicalDomain = (rawDomain || '').toLowerCase().trim();
  let cleanUrl = targetUrl;

  if (targetUrl) {
    try {
      const u = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      canonicalDomain = u.hostname.toLowerCase().replace(/^(www\.|m\.|l\.)/, '');

      // Strip common marketing and tracking query parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 'tracking', '_ga'
      ];
      for (const p of trackingParams) {
        u.searchParams.delete(p);
      }
      cleanUrl = u.toString().replace(/\/$/, '');
    } catch {
      canonicalDomain = canonicalDomain.replace(/^(www\.|m\.|l\.)/, '');
    }
  }

  const isShared = Boolean(canonicalDomain && GENERIC_SHARED_DOMAINS.has(canonicalDomain));

  return {
    canonicalDomain: canonicalDomain || undefined,
    isSharedMarketplace: isShared,
    cleanUrl: cleanUrl || undefined
  };
}

/**
 * Classifies the duplicate relationship between two candidate or lead entities
 * following the deterministic Section 6 evidence-strength hierarchy:
 * 1. EXACT_DUPLICATE: matching stable identifier (Page ID or canonical Page slug)
 * 2. PROBABLE_DUPLICATE: matching non-generic name + non-shared domain
 * 3. DISTINCT_ADVERTISER: conflicting stable IDs, conflicting domains, branch variants, or different names
 * 4. UNKNOWN_IDENTITY: shared marketplace, short generic name without corroboration, or insufficient evidence
 */
export function classifyDuplicateRelationship(
  candidate: Partial<ScrapedAdCandidate | ExtensionLead>,
  target: Partial<ScrapedAdCandidate | ExtensionLead>
): DuplicateRelationshipResult {
  const candName = normalizeAdvertiserName((candidate as any).pageName || (candidate as any).name || (candidate as any).facebookPageName);
  const targetName = normalizeAdvertiserName((target as any).pageName || (target as any).name || (target as any).facebookPageName);

  const candPageId = (candidate as any).canonicalPageId || (candidate as any).facebookPageId || (candidate as any).pageId;
  const targetPageId = (target as any).canonicalPageId || (target as any).facebookPageId || (target as any).pageId;

  const candPageNorm = normalizeFacebookPage((candidate as any).facebookPageUrl || (candidate as any).pageUrl, candPageId);
  const targetPageNorm = normalizeFacebookPage((target as any).facebookPageUrl || (target as any).pageUrl, targetPageId);

  const candDomainNorm = normalizeDestinationDomain((candidate as any).destinationUrl, (candidate as any).destinationDomain);
  const targetDomainNorm = normalizeDestinationDomain((target as any).destinationUrl, (target as any).destinationDomain);

  const compCand = getComparisonNameKey(candName);
  const compTarget = getComparisonNameKey(targetName);

  // 1. Conflicting stable identifiers -> DISTINCT_ADVERTISER
  if (candPageNorm.pageId && targetPageNorm.pageId && candPageNorm.pageId !== targetPageNorm.pageId) {
    return {
      matchLevel: 'DISTINCT_ADVERTISER',
      confidence: 'STRONG',
      reason: `CONFLICTING_FACEBOOK_PAGE_IDS: Distinct stable Page IDs ("${candPageNorm.pageId}" vs "${targetPageNorm.pageId}")`
    };
  }

  if (candPageNorm.pageSlug && targetPageNorm.pageSlug && candPageNorm.pageSlug !== targetPageNorm.pageSlug) {
    return {
      matchLevel: 'DISTINCT_ADVERTISER',
      confidence: 'STRONG',
      reason: `CONFLICTING_FACEBOOK_PAGE_SLUGS: Distinct Facebook Page slugs ("${candPageNorm.pageSlug}" vs "${targetPageNorm.pageSlug}")`
    };
  }

  if (
    candDomainNorm.canonicalDomain &&
    targetDomainNorm.canonicalDomain &&
    !candDomainNorm.isSharedMarketplace &&
    !targetDomainNorm.isSharedMarketplace &&
    candDomainNorm.canonicalDomain !== targetDomainNorm.canonicalDomain
  ) {
    return {
      matchLevel: 'DISTINCT_ADVERTISER',
      confidence: 'STRONG',
      reason: `CONFLICTING_DESTINATION_DOMAINS: Conflicting domains ("${candDomainNorm.canonicalDomain}" vs "${targetDomainNorm.canonicalDomain}")`
    };
  }

  // 2. Check local branch relationship
  const branchCheck = detectBranchRelationship(candName, targetName, compCand, compTarget);
  if (branchCheck.isBranchVariant) {
    const isSamePage = Boolean(
      (candPageNorm.pageId && targetPageNorm.pageId && candPageNorm.pageId === targetPageNorm.pageId) ||
      (candPageNorm.pageSlug && targetPageNorm.pageSlug && candPageNorm.pageSlug === targetPageNorm.pageSlug)
    );
    if (!isSamePage) {
      return {
        matchLevel: 'DISTINCT_ADVERTISER',
        confidence: 'MODERATE',
        reason: `DISTINCT_LOCAL_BRANCH: Branch variant detected ("${candName}" vs "${targetName}") without shared Page ID`
      };
    }
  }

  // 3. Exact Duplicate: matching stable identifier
  if (candPageNorm.pageId && targetPageNorm.pageId && candPageNorm.pageId === targetPageNorm.pageId) {
    return {
      matchLevel: 'EXACT_DUPLICATE',
      confidence: 'STRONG',
      reason: `EXACT_FACEBOOK_PAGE_ID_MATCH: Identical Facebook Page ID ${candPageNorm.pageId}`
    };
  }

  if (candPageNorm.pageSlug && targetPageNorm.pageSlug && candPageNorm.pageSlug === targetPageNorm.pageSlug) {
    return {
      matchLevel: 'EXACT_DUPLICATE',
      confidence: 'STRONG',
      reason: `EXACT_FACEBOOK_PAGE_SLUG_MATCH: Identical Facebook Page slug "${candPageNorm.pageSlug}"`
    };
  }

  // 4. Probable Duplicate: matching non-generic name + non-shared domain
  if (
    compCand &&
    compTarget &&
    compCand === compTarget &&
    candDomainNorm.canonicalDomain &&
    targetDomainNorm.canonicalDomain &&
    !candDomainNorm.isSharedMarketplace &&
    candDomainNorm.canonicalDomain === targetDomainNorm.canonicalDomain
  ) {
    return {
      matchLevel: 'PROBABLE_DUPLICATE',
      confidence: 'STRONG',
      reason: `PROBABLE_NAME_AND_DOMAIN_MATCH: Corroborated brand name and destination domain "${candDomainNorm.canonicalDomain}"`
    };
  }

  // 5. Shared marketplace: cannot establish identity without Page ID
  if (candDomainNorm.isSharedMarketplace || targetDomainNorm.isSharedMarketplace) {
    return {
      matchLevel: 'UNKNOWN_IDENTITY',
      confidence: 'UNRESOLVED',
      reason: 'SHARED_MARKETPLACE_DOMAIN: Shared marketplace host cannot establish entity identity'
    };
  }

  // 6. Generic short name: ambiguous
  if (isShortGenericName(candName) || isShortGenericName(targetName)) {
    return {
      matchLevel: 'UNKNOWN_IDENTITY',
      confidence: 'UNRESOLVED',
      reason: 'GENERIC_NAME_AMBIGUOUS: Short generic brand name requires independent corroborating evidence'
    };
  }

  // 7. Non-generic Name match alone without Page or Domain
  if (compCand && compTarget && compCand === compTarget) {
    return {
      matchLevel: 'PROBABLE_DUPLICATE',
      confidence: 'MODERATE',
      reason: 'SIMILAR_NAME_UNVERIFIED: Matching display name without corroborating Page ID, Page slug, or domain'
    };
  }

  // 8. Distinct advertisers: different names, no shared identifiers
  if (compCand !== compTarget) {
    return {
      matchLevel: 'DISTINCT_ADVERTISER',
      confidence: 'MODERATE',
      reason: `DISTINCT_ADVERTISER_NAMES: Distinct brand names ("${candName}" vs "${targetName}") without shared identity evidence`
    };
  }

  return {
    matchLevel: 'UNKNOWN_IDENTITY',
    confidence: 'WEAK',
    reason: 'INSUFFICIENT_IDENTITY_EVIDENCE: Neither record possesses sufficient stable identity anchors'
  };
}

/**
 * In-Memory High-Speed Entity Resolution Index
 * Maintains $O(1)$ lookup maps for stable entity reconciliation across research runs.
 */
export class EntityResolutionIndex {
  public pageIdToKey = new Map<string, string>();
  public pageSlugToKey = new Map<string, string>();
  public nameDomainToKey = new Map<string, string>();
  public specificNameToKey = new Map<string, string>();
  public brandPrefixToKeys = new Map<string, string[]>();

  public indexEntity(entityKey: string, lead: ExtensionLead): void {
    if (lead.canonicalPageId) {
      this.pageIdToKey.set(lead.canonicalPageId, entityKey);
    }
    if (lead.canonicalPageSlug) {
      this.pageSlugToKey.set(lead.canonicalPageSlug, entityKey);
    }
    if (lead.facebookPageUrl) {
      const norm = normalizeFacebookPage(lead.facebookPageUrl, lead.canonicalPageId);
      if (norm.pageSlug) this.pageSlugToKey.set(norm.pageSlug, entityKey);
      if (norm.pageId) this.pageIdToKey.set(norm.pageId, entityKey);
    }

    const compName = getComparisonNameKey(lead.name);
    const domain = lead.destinationDomain?.toLowerCase();

    if (compName && domain && !GENERIC_SHARED_DOMAINS.has(domain)) {
      this.nameDomainToKey.set(`${compName}__${domain}`, entityKey);
    }

    // Index non-generic names
    if (compName && !isShortGenericName(lead.name)) {
      this.specificNameToKey.set(compName, entityKey);
    }

    // Index 2-character prefix for O(1) branch candidate grouping
    if (compName && compName.length >= 2) {
      const prefix = compName.slice(0, 2);
      let list = this.brandPrefixToKeys.get(prefix);
      if (!list) {
        list = [];
        this.brandPrefixToKeys.set(prefix, list);
      }
      list.push(entityKey);
    }
  }

  public clear(): void {
    this.pageIdToKey.clear();
    this.pageSlugToKey.clear();
    this.nameDomainToKey.clear();
    this.specificNameToKey.clear();
    this.brandPrefixToKeys.clear();
  }
}

/**
 * Resolves an incoming ad candidate against existing entities using the deterministic identity hierarchy.
 *
 * Hierarchy Precedence:
 * 1. Exact Facebook Page ID (STRONG)
 * 2. Canonical Facebook Page URL / Slug (STRONG)
 * 3. Same Advertiser Name + Same Canonical Domain (Non-Marketplace) (STRONG)
 * 4. Local Branch vs Parent Brand distinction (KEEP SEPARATE if pages differ)
 * 5. Generic Short Name Protection (KEEP SEPARATE if evidence is weak)
 */
export function evaluateEntityMerge(
  cand: ScrapedAdCandidate,
  existingEntities: Map<string, ExtensionLead>,
  index: EntityResolutionIndex
): EntityMergeDecision {
  const cleanName = normalizeAdvertiserName(cand.pageName);
  const compName = getComparisonNameKey(cleanName);
  const pageNorm = normalizeFacebookPage(cand.facebookPageUrl, cand.facebookPageId || (cand as any).pageId);
  const domainNorm = normalizeDestinationDomain(cand.destinationUrl, cand.destinationDomain);

  // 1. TIER 1: Exact Facebook Page ID Match
  if (pageNorm.pageId && index.pageIdToKey.has(pageNorm.pageId)) {
    const targetKey = index.pageIdToKey.get(pageNorm.pageId)!;
    return {
      shouldMerge: true,
      targetKey,
      confidence: 'STRONG',
      reason: `MERGE_EXACT_FACEBOOK_PAGE_ID: Matched Page ID ${pageNorm.pageId}`,
      relationshipType: 'INDEPENDENT_BUSINESS',
      matchLevel: 'EXACT_DUPLICATE'
    };
  }

  // 2. TIER 2: Canonical Facebook Page Slug / URL Match
  if (pageNorm.pageSlug && index.pageSlugToKey.has(pageNorm.pageSlug)) {
    const targetKey = index.pageSlugToKey.get(pageNorm.pageSlug)!;
    return {
      shouldMerge: true,
      targetKey,
      confidence: 'STRONG',
      reason: `MERGE_CANONICAL_FACEBOOK_PAGE_SLUG: Matched Page slug "${pageNorm.pageSlug}"`,
      relationshipType: 'INDEPENDENT_BUSINESS',
      matchLevel: 'EXACT_DUPLICATE'
    };
  }

  // 3. TIER 3: Corroborated Name + Canonical Domain (Non-Marketplace)
  if (compName && domainNorm.canonicalDomain && !domainNorm.isSharedMarketplace) {
    const nameDomainKey = `${compName}__${domainNorm.canonicalDomain}`;
    if (index.nameDomainToKey.has(nameDomainKey)) {
      const targetKey = index.nameDomainToKey.get(nameDomainKey)!;
      const targetEntity = existingEntities.get(targetKey);

      // Verify no direct conflict on Facebook Page ID or Slug
      const targetPageNorm = normalizeFacebookPage(targetEntity?.facebookPageUrl, targetEntity?.canonicalPageId);
      if (
        (pageNorm.pageId && targetPageNorm.pageId && pageNorm.pageId !== targetPageNorm.pageId) ||
        (pageNorm.pageSlug && targetPageNorm.pageSlug && pageNorm.pageSlug !== targetPageNorm.pageSlug)
      ) {
        // Conflicting distinct Facebook pages: do NOT merge!
        const fallbackKey = pageNorm.pageId
          ? `fbid_${pageNorm.pageId}`
          : (pageNorm.pageSlug ? `fbslug_${pageNorm.pageSlug}` : `cand_${cand.libraryId}`);
        return {
          shouldMerge: false,
          targetKey: fallbackKey,
          confidence: 'MODERATE',
          reason: `NON_MERGE_CONFLICTING_FACEBOOK_PAGE: Shared domain ${domainNorm.canonicalDomain} but conflicting Facebook Page ("${pageNorm.pageId || pageNorm.pageSlug}" vs "${targetPageNorm.pageId || targetPageNorm.pageSlug}")`,
          relationshipType: 'INDEPENDENT_BUSINESS',
          matchLevel: 'DISTINCT_ADVERTISER'
        };
      }

      return {
        shouldMerge: true,
        targetKey,
        confidence: 'STRONG',
        reason: `MERGE_CORROBORATED_NAME_AND_DOMAIN: Matched brand "${cleanName}" and domain "${domainNorm.canonicalDomain}"`,
        relationshipType: 'INDEPENDENT_BUSINESS',
        matchLevel: 'PROBABLE_DUPLICATE'
      };
    }
  }

  // 4. Branch / Location Distinction Check against existing entities
  const branchCandidateKeys = (compName && compName.length >= 2)
    ? (index.brandPrefixToKeys.get(compName.slice(0, 2)) || [])
    : Array.from(existingEntities.keys());

  for (const key of branchCandidateKeys) {
    const existing = existingEntities.get(key);
    if (!existing) continue;
    const branchCheck = detectBranchRelationship(cleanName, existing.name, compName);
    if (branchCheck.isBranchVariant) {
      // Local branch discovered!
      // If they do not share the exact same Facebook Page or Domain, strictly KEEP SEPARATE
      const existingPage = normalizeFacebookPage(existing.facebookPageUrl, existing.canonicalPageId);
      const isSamePage = Boolean(
        (pageNorm.pageId && existingPage.pageId && pageNorm.pageId === existingPage.pageId) ||
        (pageNorm.pageSlug && existingPage.pageSlug && pageNorm.pageSlug === existingPage.pageSlug)
      );

      if (!isSamePage) {
        const branchKey = pageNorm.pageSlug
          ? `fbslug_${pageNorm.pageSlug}`
          : pageNorm.pageId
            ? `fbid_${pageNorm.pageId}`
            : `branch_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        return {
          shouldMerge: false,
          targetKey: branchKey,
          confidence: 'MODERATE',
          reason: `NON_MERGE_LOCAL_BRANCH_DISTINCTION: Distinct local branch detected ("${cleanName}" vs "${existing.name}") without shared Page ID`,
          relationshipType: 'LOCAL_BRANCH',
          matchLevel: 'DISTINCT_ADVERTISER'
        };
      }
    }
  }

  // 5. Shared Marketplace Protection
  if (domainNorm.isSharedMarketplace) {
    // Shared marketplace domain (Amazon, Daraz, Etsy):
    // Cannot merge on domain; requires Page identity
    const key = pageNorm.pageSlug
      ? `fbslug_${pageNorm.pageSlug}`
      : pageNorm.pageId
        ? `fbid_${pageNorm.pageId}`
        : `mkp_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    return {
      shouldMerge: false,
      targetKey: key,
      confidence: 'MODERATE',
      reason: `NON_MERGE_SHARED_MARKETPLACE_DOMAIN: Shared host/marketplace domain (${domainNorm.canonicalDomain}) cannot trigger automatic merge`,
      relationshipType: 'INDEPENDENT_BUSINESS',
      matchLevel: 'UNKNOWN_IDENTITY'
    };
  }

  // 6. Generic Short Brand Protection
  if (isShortGenericName(cleanName)) {
    // Short generic name without corroborating page or domain
    const uniqueKey = pageNorm.pageSlug
      ? `fbslug_${pageNorm.pageSlug}`
      : pageNorm.pageId
        ? `fbid_${pageNorm.pageId}`
        : `unres_${cleanName.toLowerCase()}_${cand.libraryId}`;
    return {
      shouldMerge: false,
      targetKey: uniqueKey,
      confidence: 'UNRESOLVED',
      reason: `NON_MERGE_GENERIC_NAME_AMBIGUOUS: Short generic brand name "${cleanName}" requires corroborating Page or Domain`,
      relationshipType: 'UNRESOLVED_RELATIONSHIP',
      matchLevel: 'UNKNOWN_IDENTITY'
    };
  }

  // 7. Non-generic Name Alone Match Check
  if (compName && index.specificNameToKey.has(compName)) {
    const targetKey = index.specificNameToKey.get(compName)!;
    const targetEntity = existingEntities.get(targetKey);
    const targetDomainNorm = normalizeDestinationDomain(targetEntity?.destinationUrl, targetEntity?.destinationDomain);
    const targetPageNorm = normalizeFacebookPage(targetEntity?.facebookPageUrl, targetEntity?.canonicalPageId);

    // If both have domains and domains conflict: DO NOT MERGE!
    if (
      domainNorm.canonicalDomain &&
      targetDomainNorm.canonicalDomain &&
      domainNorm.canonicalDomain !== targetDomainNorm.canonicalDomain
    ) {
      const distinctKey = pageNorm.pageSlug
        ? `fbslug_${pageNorm.pageSlug}`
        : pageNorm.pageId
          ? `fbid_${pageNorm.pageId}`
          : `dom_${cleanName.toLowerCase()}_${domainNorm.canonicalDomain}`;
      return {
        shouldMerge: false,
        targetKey: distinctKey,
        confidence: 'MODERATE',
        reason: `NON_MERGE_CONFLICTING_DESTINATION_DOMAIN: Identical brand name but conflicting domains ("${domainNorm.canonicalDomain}" vs "${targetDomainNorm.canonicalDomain}")`,
        relationshipType: 'INDEPENDENT_BUSINESS',
        matchLevel: 'DISTINCT_ADVERTISER'
      };
    }

    // If both have Page IDs and they conflict: DO NOT MERGE!
    if (
      pageNorm.pageId &&
      targetPageNorm.pageId &&
      pageNorm.pageId !== targetPageNorm.pageId
    ) {
      const distinctKey = `fbid_${pageNorm.pageId}`;
      return {
        shouldMerge: false,
        targetKey: distinctKey,
        confidence: 'MODERATE',
        reason: `NON_MERGE_CONFLICTING_FACEBOOK_PAGE_ID: Identical brand name but conflicting Page IDs ("${pageNorm.pageId}" vs "${targetPageNorm.pageId}")`,
        relationshipType: 'INDEPENDENT_BUSINESS',
        matchLevel: 'DISTINCT_ADVERTISER'
      };
    }

    // If both have Page slugs and they conflict: DO NOT MERGE!
    if (
      pageNorm.pageSlug &&
      targetPageNorm.pageSlug &&
      pageNorm.pageSlug !== targetPageNorm.pageSlug
    ) {
      const distinctKey = `fbslug_${pageNorm.pageSlug}`;
      return {
        shouldMerge: false,
        targetKey: distinctKey,
        confidence: 'MODERATE',
        reason: `NON_MERGE_CONFLICTING_FACEBOOK_PAGE: Identical brand name but conflicting Page slugs ("${pageNorm.pageSlug}" vs "${targetPageNorm.pageSlug}")`,
        relationshipType: 'INDEPENDENT_BUSINESS',
        matchLevel: 'DISTINCT_ADVERTISER'
      };
    }

    // Moderate brand name match: DO NOT auto-merge without corroborating Page or Domain evidence
    const modKey = pageNorm.pageSlug
      ? `fbslug_${pageNorm.pageSlug}`
      : pageNorm.pageId
        ? `fbid_${pageNorm.pageId}`
        : domainNorm.canonicalDomain
          ? `dom_${compName}_${domainNorm.canonicalDomain}`
          : `cand_${compName}_${cand.libraryId}`;

    return {
      shouldMerge: false,
      targetKey: modKey,
      confidence: 'MODERATE',
      reason: `MERGE_CANDIDATE_MODERATE_IDENTITY: Brand name "${cleanName}" matches candidate entity "${targetEntity?.name}" but lacks strong corroborating Page ID, Page URL, or Domain evidence`,
      relationshipType: 'UNRESOLVED_RELATIONSHIP',
      matchLevel: 'UNKNOWN_IDENTITY'
    };
  }

  // 8. New Unique Entity
  const baseKey = cand.facebookPageId && cand.facebookPageId.length > 4
    ? `fb_${cand.facebookPageId}`
    : `name_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const newKey = existingEntities.has(baseKey)
    ? `${baseKey}_${cand.libraryId}`
    : baseKey;

  return {
    shouldMerge: false,
    targetKey: newKey,
    confidence: pageNorm.pageId || pageNorm.pageSlug ? 'STRONG' : domainNorm.canonicalDomain ? 'MODERATE' : 'WEAK',
    reason: 'NEW_UNIQUE_ENTITY: Discovered new independent advertiser identity',
    relationshipType: 'INDEPENDENT_BUSINESS',
    matchLevel: 'DISTINCT_ADVERTISER'
  };
}

/**
 * Merges candidate ad data into an existing entity record while preserving all evidence,
 * Ad Library IDs, observed URLs, matched queries, and merge audit history.
 */
export function mergeCandidateIntoEntity(
  target: ExtensionLead,
  cand: ScrapedAdCandidate,
  decision: EntityMergeDecision,
  sourceQuery?: string,
  targetCountryCode?: string
): void {
  // 0. Initialize activeAdLibraryIds from pre-existing target state before merging new candidate
  if (!target.activeAdLibraryIds) {
    if (typeof target.activeAdCount === 'number' && target.activeAdCount > 0) {
      target.activeAdLibraryIds = (target.adLibraryIds || []).slice(0, target.activeAdCount);
    } else {
      target.activeAdLibraryIds = [];
    }
  }

  // 1. Preserve unique, sanitized Ad Library IDs
  if (!target.adLibraryIds) {
    target.adLibraryIds = [];
  }
  if (/^[0-9]{5,25}$/.test(cand.libraryId) && !target.adLibraryIds.includes(cand.libraryId)) {
    target.adLibraryIds.push(cand.libraryId);
  }
  target.adLibraryIds = sanitizeAdLibraryIds(target.adLibraryIds);

  // 2. Synchronize accurate ad counts based on validated unique IDs
  target.adCount = target.adLibraryIds.length;
  if (cand.isActive !== false && /^[0-9]{5,25}$/.test(cand.libraryId)) {
    if (!target.activeAdLibraryIds.includes(cand.libraryId)) {
      target.activeAdLibraryIds.push(cand.libraryId);
    }
  }
  target.activeAdLibraryIds = target.activeAdLibraryIds.filter(id => target.adLibraryIds.includes(id));
  target.activeAdCount = target.activeAdLibraryIds.length;

  // 3. Preserve unique matched queries & keywords
  if (!target.matchedKeywords) target.matchedKeywords = [];
  if (sourceQuery) {
    if (!target.matchedQueries) target.matchedQueries = [];
    if (!target.matchedQueries.includes(sourceQuery)) {
      target.matchedQueries.push(sourceQuery);
    }
    if (!target.matchedKeywords.includes(sourceQuery)) {
      target.matchedKeywords.push(sourceQuery);
    }
  }
  if (cand.observedKeyword) {
    if (!target.matchedKeywords.includes(cand.observedKeyword)) {
      target.matchedKeywords.push(cand.observedKeyword);
    }
  }

  // 4. Enrich Facebook Page identity
  const pageNorm = normalizeFacebookPage(cand.facebookPageUrl, cand.facebookPageId);
  if (!target.canonicalPageId && pageNorm.pageId) {
    target.canonicalPageId = pageNorm.pageId;
  }
  if (!target.canonicalPageSlug && pageNorm.pageSlug) {
    target.canonicalPageSlug = pageNorm.pageSlug;
  }
  if (!target.facebookPageUrl && pageNorm.canonicalUrl) {
    target.facebookPageUrl = pageNorm.canonicalUrl;
    target.facebookPageState = 'found';
  }

  // 5. Enrich destination URL and domain
  const domainNorm = normalizeDestinationDomain(cand.destinationUrl, cand.destinationDomain);
  if (!target.observedDomains) target.observedDomains = [];
  if (domainNorm.canonicalDomain && !target.observedDomains.includes(domainNorm.canonicalDomain)) {
    target.observedDomains.push(domainNorm.canonicalDomain);
  }
  if (!target.destinationDomain && domainNorm.canonicalDomain) {
    target.destinationDomain = domainNorm.canonicalDomain;
  }
  if (!target.destinationUrl && domainNorm.cleanUrl) {
    target.destinationUrl = domainNorm.cleanUrl;
    target.websiteState = 'found';
  }

  if (!target.observedUrls) target.observedUrls = [];
  if (cand.destinationUrl && !target.observedUrls.includes(cand.destinationUrl)) {
    target.observedUrls.push(cand.destinationUrl);
  }

  // 6. Enrich aliases
  const rawClean = normalizeAdvertiserName(cand.pageName);
  if (!target.aliases) target.aliases = [];
  if (rawClean && rawClean !== target.name && !target.aliases.includes(rawClean)) {
    target.aliases.push(rawClean);
  }

  // 7. Enrich sample creative
  if (!target.sampleCopy && cand.bodyCopy) {
    target.sampleCopy = cand.bodyCopy;
  }
  if (!target.sampleCta && cand.ctaText) {
    target.sampleCta = cand.ctaText;
  }

  // 7.5. Preserve ad-level CTA and destination evidence (Phase 0.4)
  if (!target.adEvidence) target.adEvidence = [];
  const adCtaRes = cand.ctaType
    ? { ctaType: cand.ctaType, normalizedText: cand.ctaText || '', reasonCode: 'CTA_TEXT_MATCH', reason: '' }
    : classifyCta(cand.ctaText);
  const adDestRes = cand.destinationType
    ? { destinationType: cand.destinationType, confidence: cand.destinationConfidence || 'HIGH', reasonCode: cand.destinationReasonCode || 'VISIBLE_EXTERNAL_DESTINATION', reason: '' }
    : classifyDestination({
        destinationUrl: cand.destinationUrl,
        destinationDomain: cand.destinationDomain,
        ctaText: cand.ctaText,
        ctaType: adCtaRes.ctaType,
        bodyCopy: cand.bodyCopy,
        rawText: cand.rawText
      });

  const existingAdIdx = target.adEvidence.findIndex(e => e.libraryId === cand.libraryId);
  const adEvidenceItem: AdLevelEvidence = {
    libraryId: cand.libraryId,
    ctaText: cand.ctaText,
    ctaType: adCtaRes.ctaType,
    destinationType: adDestRes.destinationType,
    destinationUrl: cand.destinationUrl,
    destinationDomain: cand.destinationDomain,
    reasonCode: adDestRes.reasonCode,
    confidence: adDestRes.confidence,
    observedAt: cand.startedRunning || new Date().toISOString()
  };

  if (existingAdIdx >= 0) {
    target.adEvidence[existingAdIdx] = adEvidenceItem;
  } else {
    target.adEvidence.push(adEvidenceItem);
  }

  // Derive aggregated advertiser-level CTA & Destination intelligence
  const aggSummary = aggregateAdEvidence(target.adEvidence);
  target.observedCtaTexts = aggSummary.observedCtaTexts;
  target.observedCtaTypes = aggSummary.observedCtaTypes;
  target.observedDestinationTypes = aggSummary.observedDestinationTypes;
  target.primaryCtaType = aggSummary.primaryCtaType;
  target.primaryDestinationType = aggSummary.primaryDestinationType;
  target.destinationReasonCode = aggSummary.destinationReasonCode;
  target.destinationConfidence = aggSummary.destinationConfidence;

  // 7.6. Preserve and merge contact observations (Phase 7)
  const incomingContacts = cand.contactObservations || [
    ...(cand.observedPhones || []),
    ...(cand.observedEmails || [])
  ];
  if (incomingContacts.length > 0) {
    target.contactProfile = mergeContactObservations(target.contactProfile, incomingContacts);
    target.contactQualityState = target.contactProfile.overallQualityState;
    target.businessPhone = target.contactProfile.primaryPhone;
    target.businessEmail = target.contactProfile.primaryEmail;
    target.phones = target.contactProfile.observedPhones.map(p => p.normalizedValue || p.rawValue);
    target.emails = target.contactProfile.observedEmails.map(e => e.normalizedValue || e.rawValue);
    target.contactObservations = [...target.contactProfile.observedPhones, ...target.contactProfile.observedEmails];
  }

  // 8. Record structured merge audit entry (idempotent - no duplicate records)
  if (!target.mergeHistory) target.mergeHistory = [];
  const isDuplicateMerge = target.mergeHistory.some(
    m => m.sourceLibraryId === cand.libraryId && m.sourceQuery === sourceQuery
  );
  if (!isDuplicateMerge) {
    target.mergeHistory.push({
      timestamp: new Date().toISOString(),
      mergeReason: decision.reason,
      sourceLibraryId: cand.libraryId,
      sourceQuery,
      confidence: decision.confidence
    });
  }

  // 9. Re-evaluate geographic physical location if relevant country code is available
  const evalTargetCountry = targetCountryCode || target.targetCountryCode || target.locationCode;
  if (evalTargetCountry) {
    const updatedGeo = evaluateGeographicOrigin({
      pageName: target.name,
      pageUrl: target.facebookPageUrl,
      destinationUrl: target.destinationUrl || cand.destinationUrl,
      destinationDomain: target.destinationDomain || cand.destinationDomain,
      bodyCopy: [target.sampleCopy, cand.bodyCopy].filter(Boolean).join(' '),
      ctaText: [target.sampleCta, cand.ctaText].filter(Boolean).join(' ')
    }, evalTargetCountry);

    const shouldUpdateGeo =
      !target.geographicClassification ||
      target.geographicClassification === 'LOCATION_UNKNOWN' ||
      updatedGeo.classification === 'FOREIGN_VERIFIED' ||
      (target.geographicClassification === 'LOCAL_PROBABLE' && updatedGeo.classification === 'LOCAL_VERIFIED') ||
      updatedGeo.reasonCode === 'CONFLICTING_LOCATION_EVIDENCE';

    if (shouldUpdateGeo) {
      target.targetCountryCode = updatedGeo.targetCountryCode;
      target.businessCountryCode = updatedGeo.businessCountryCode;
      target.geographicClassification = updatedGeo.classification;
      target.businessLocationConfidence = updatedGeo.confidence;
      target.businessLocationEvidence = Array.from(new Set([
        ...(target.businessLocationEvidence || []),
        ...updatedGeo.evidence
      ]));
      target.businessLocationReason = updatedGeo.reason;
      target.businessLocationReasonCode = updatedGeo.reasonCode;
    }
  }

  // 10. Recalculate deterministic lead score and prioritization breakdown (Phase 8)
  const priorityRes = calculateLeadScore(target);
  target.leadScore = priorityRes.score;
  target.normalizedScore = priorityRes.normalizedScore;
  target.prioritizationTier = priorityRes.tier;
  target.scoreConfidence = priorityRes.confidence;
  target.scoreBreakdown = priorityRes.breakdown;
  target.scoreModelVersion = priorityRes.breakdown.modelVersion;
  target.scoreExplanation = priorityRes.explanation;
}
