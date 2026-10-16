/**
 * Meta Ad Library DOM Extraction & Normalization Adapter
 * Operates safely inside Content Scripts and local browser automation contexts.
 */

import { MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH } from './types.ts';
import type {
  ScrapedAdCandidate,
  ExtensionLead,
  ExtensionResearchRun,
  CardValidationOutcome,
  AdExtractionDiagnostics,
  ExtractionResultStatus,
  AdExtractionResult,
  AdLevelEvidence,
  LeadExportOptions
} from './types.ts';
import { LeadRelevanceEngine } from './relevanceEngine.ts';
import type { ResearchIntent } from './relevanceEngine.ts';
import { evaluateGeographicOrigin } from './geographicClassifier.ts';
import { classifyCta, classifyDestination, aggregateAdEvidence } from './destinationClassifier.ts';
import { evaluateLeadQualificationGates } from './qualificationGate.ts';
import { calculateLeadScore } from './leadPrioritizer.ts';
import {
  extractContactsFromAdCard,
  aggregateContactObservations,
  mergeContactObservations
} from './contactQuality.ts';
import type {
  ContactObservation,
  ContactEntityProfile
} from './contactQuality.ts';
import {
  EntityResolutionIndex,
  evaluateEntityMerge,
  normalizeAdvertiserName,
  normalizeFacebookPage,
  normalizeDestinationDomain,
  getComparisonNameKey,
  isShortGenericName,
  GENERIC_SHARED_DOMAINS
} from './entityResolver.ts';

/**
 * Checks whether a given URL is a Meta Ad Library search or listing page.
 */
export function isMetaAdLibraryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isFbHost = host === 'facebook.com' || host.endsWith('.facebook.com');
    return isFbHost && parsed.pathname.includes('/ads/library');
  } catch {
    return false;
  }
}

/**
 * Detects whether Meta's anti-bot challenge, CAPTCHA, or login wall is active.
 */
export function checkForBotChallenge(doc: Document): { isBlocked: boolean; reason?: string; code?: 'CHALLENGED' | 'RATE_LIMITED' } {
  // If valid ad cards are present in the DOM, public ad library feed is active and NOT blocked
  const hasAdCards = Array.from(doc.querySelectorAll('span, div')).some(
    el => {
      const txt = el.textContent || '';
      return /(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*[0-9]+/i.test(txt);
    }
  );
  if (hasAdCards) {
    return { isBlocked: false };
  }

  const text = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';

  if (/(?:Security\s+Check|Enter\s+the\s+characters|verify\s+you\s+are\s+human|checkpoint|captcha)/i.test(text)) {
    return { isBlocked: true, reason: 'Meta Security Check / CAPTCHA challenge presented.', code: 'CHALLENGED' };
  }

  if (/(?:You(?:’|'|\s+are)\s+temporarily\s+blocked|Rate\s+limit\s+exceeded|Too\s+Many\s+Requests|Please\s+slow\s+down)/i.test(text)) {
    return { isBlocked: true, reason: 'Meta access temporarily rate-limited.', code: 'RATE_LIMITED' };
  }

  if (text.includes('Log In to Facebook') && doc.querySelectorAll('input[type="password"]').length > 0) {
    return { isBlocked: true, reason: 'Meta mandatory login dialog restricting public ad library access.', code: 'CHALLENGED' };
  }

  return { isBlocked: false };
}

/**
 * Extracts and decodes external destination URLs from Meta redirect shims
 * (e.g. https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2F...&h=...)
 */
export function extractUrlFromShim(rawHref: string): { destinationUrl?: string; domain?: string } {
  if (!rawHref || typeof rawHref !== 'string') return {};

  let targetUrl = rawHref.trim();

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();

    // Check for Meta link shim
    if (host.includes('facebook.com') && (parsed.pathname === '/l.php' || parsed.pathname.includes('/l.php'))) {
      const uParam = parsed.searchParams.get('u');
      if (uParam) {
        targetUrl = decodeURIComponent(uParam);
      }
    }

    const finalParsed = new URL(targetUrl);
    const finalHost = finalParsed.hostname.toLowerCase();

    // Exclude Facebook internal domains
    const fbInternalDomains = [
      'facebook.com',
      'fb.com',
      'fb.me',
      'meta.com',
      'messenger.com',
      'instagram.com',
      'threads.net',
      'whatsapp.com'
    ];

    const isInternal = fbInternalDomains.some(
      domain => finalHost === domain || finalHost.endsWith('.' + domain)
    );

    if (isInternal) {
      // Instagram links can sometimes be the primary destination profile
      if (finalHost.includes('instagram.com')) {
        return {
          destinationUrl: targetUrl,
          domain: 'instagram.com'
        };
      }
      return {};
    }

    const cleanDomain = finalHost.replace(/^www\./, '');
    return {
      destinationUrl: targetUrl,
      domain: cleanDomain
    };
  } catch {
    return {};
  }
}

/**
 * Extracts Facebook page identifier and canonical URL
 */
export function extractFacebookPageInfo(href: string, linkText?: string): { pageUrl?: string; pageName?: string } {
  if (!href) return {};

  try {
    const parsed = new URL(href);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('facebook.com') && !host.includes('fb.com')) return {};

    const path = parsed.pathname;
    // Exclude generic ad library navigation or policy links
    if (
      path === '/' ||
      path.startsWith('/ads/') ||
      path.startsWith('/policy') ||
      path.startsWith('/help') ||
      path.startsWith('/settings') ||
      path.startsWith('/legal') ||
      path.includes('terms')
    ) {
      return {};
    }

    // Canonical link
    const cleanUrl = `https://www.facebook.com${path}`;
    return {
      pageUrl: cleanUrl,
      pageName: linkText?.trim() || undefined
    };
  } catch {
    return {};
  }
}

/**
 * Normalizes Ad Library text by stripping non-breaking spaces, BOM, and collapsing whitespace.
 */
export function normalizeAdLibraryText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\uFF1A\uFE55\u05C3\u2236]/g, ':')
    .replace(/[\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ExtractedIdentifierResult {
  id: string;
  rawLabel: string;
  confidence: 'HIGH' | 'LOW';
  isAmbiguous?: boolean;
  ambiguityReason?: string;
  rawExtracted?: string;
}

/**
 * Sanitizes and deduplicates a collection of Ad Library IDs using strict string comparison.
 * Preserves distinct valid IDs belonging to different ads from the same advertiser without
 * assuming uniform ID lengths. Rejects candidate IDs only when actual boundary evidence or
 * day-of-month concatenation corroborates an artifact.
 */
export function sanitizeAdLibraryIds(
  ids: string[],
  options?: { preservePrefixOverlap?: boolean; verifiedDistinctIds?: Set<string> }
): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = Array.from(new Set(ids.map(id => (id || '').trim()).filter(id => /^[0-9]{5,25}$/.test(id))));
  
  if (options?.preservePrefixOverlap) {
    return unique;
  }
  
  // Sort by length ascending so shorter (canonical) IDs come first
  unique.sort((a, b) => a.length - b.length);
  
  const sanitized: string[] = [];
  for (const id of unique) {
    if (options?.verifiedDistinctIds?.has(id)) {
      sanitized.push(id);
      continue;
    }
    // A suspected concatenated ID is rejected only when corroborated by a day-of-month (1-31) or small ad counter suffix
    const isPrefixArtifact = sanitized.some(canonicalId => {
      if (canonicalId.length < 12 || !id.startsWith(canonicalId)) return false;
      const extraDigits = id.slice(canonicalId.length);
      const extraNum = parseInt(extraDigits, 10);
      return extraDigits.length === 2 && !isNaN(extraNum) && extraNum >= 10 && extraNum <= 31;
    });
    if (!isPrefixArtifact) {
      sanitized.push(id);
    }
  }
  return sanitized;
}

/**
 * Extracts and validates an Ad Library identifier across supported locales and contextual indicators.
 * Does not assume an arbitrary universal ID length. Preserves exact boundaries from source DOM.
 * Uses surrounding date text only as corroborating context to resolve concatenated day-of-month digits.
 * If boundary collision remains ambiguous without corroborating context, it is flagged as ambiguous.
 */
export function extractAdIdentifier(
  text: string,
  context?: { surroundingText?: string }
): ExtractedIdentifierResult | null {
  if (!text) return null;
  const clean = normalizeAdLibraryText(text);

  // 1. High-confidence explicit Ad Library ID patterns across locales
  const explicitPatterns: Array<{ regex: RegExp; label: string }> = [
    // English
    { regex: /(?:Library\s+ID|Ad\s+Library\s+ID)\s*:\s*([0-9]{5,25})/i, label: 'Library ID' },
    // Spanish
    { regex: /(?:ID\s+de\s+la\s+biblioteca|ID\s+de\s+biblioteca)\s*:\s*([0-9]{5,25})/i, label: 'ID de la biblioteca' },
    // French
    { regex: /(?:Identifiant\s+de\s+la\s+biblioth[eè]que|ID\s+de\s+la\s+biblioth[eè]que)\s*:\s*([0-9]{5,25})/i, label: 'Identifiant de la bibliothèque' },
    // German
    { regex: /(?:Bibliotheks-?ID|Bibliothek-?ID)\s*:\s*([0-9]{5,25})/i, label: 'Bibliotheks-ID' },
    // Italian
    { regex: /(?:ID\s+della\s+libreria|ID\s+libreria)\s*:\s*([0-9]{5,25})/i, label: 'ID della libreria' },
    // Portuguese
    { regex: /(?:ID\s+da\s+biblioteca)\s*:\s*([0-9]{5,25})/i, label: 'ID da biblioteca' },
    // Dutch
    { regex: /(?:Bibliotheek-?ID|ID\s+van\s+de\s+bibliotheek)\s*:\s*([0-9]{5,25})/i, label: 'Bibliotheek-ID' },
    // Polish
    { regex: /(?:Identyfikator\s+(?:w\s+)?Bibliotece|ID\s+biblioteki)\s*:\s*([0-9]{5,25})/i, label: 'Identyfikator w Bibliotece' },
    // Nordic (Danish, Swedish, Norwegian)
    { regex: /(?:Biblioteks-?ID)\s*:\s*([0-9]{5,25})/i, label: 'Biblioteks-ID' }
  ];

  // Comprehensive multi-locale month boundary regex across English, Spanish, French, German, Italian, and Portuguese
  const multiLocaleMonthRegex = /^\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic|Janv|F[eé]vr|Mars|Avr|Mai|Juin|Juil|Ao[uû]t|Sept|M[aä]r|Okt|Dez|Fev|Set|Out|Gen|Mag|Giu|Lug|Ott)\b/i;

  for (const { regex, label } of explicitPatterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      let extractedId = match[1];
      const afterMatch = clean.slice((match.index ?? 0) + match[0].length);

      // Corroborating date context: check if trailing 1-2 digits fused with an adjacent day-of-month before a month token (supporting all Meta locales)
      const monthMatch = afterMatch.match(multiLocaleMonthRegex);
      if (monthMatch && extractedId.length >= 13) {
        const lastTwo = extractedId.slice(-2);
        const lastOne = extractedId.slice(-1);
        const numTwo = parseInt(lastTwo, 10);
        const numOne = parseInt(lastOne, 10);
        if (numTwo >= 1 && numTwo <= 31 && extractedId.length - 2 >= 12) {
          extractedId = extractedId.slice(0, -2);
        } else if (numOne >= 1 && numOne <= 9 && extractedId.length - 1 >= 12) {
          extractedId = extractedId.slice(0, -1);
        }
      } else if (/^[A-Za-z]/.test(afterMatch)) {
        return {
          id: extractedId,
          rawLabel: label,
          confidence: 'LOW',
          isAmbiguous: true,
          ambiguityReason: `Ambiguous boundary: digits directly fused into non-digit token "${afterMatch.slice(0, 15)}"`,
          rawExtracted: match[0]
        };
      }

      return {
        id: extractedId,
        rawLabel: label,
        confidence: 'HIGH'
      };
    }
  }

  // 2. Contextual "ID: 123456789" only when surrounding context confirms ad card domain
  const contextualMatch = clean.match(/\bID\s*:\s*([0-9]{5,25})/i);
  if (contextualMatch && contextualMatch[1]) {
    const ctx = normalizeAdLibraryText(context?.surroundingText || clean);
    const hasAdSignal = /(?:Library|Biblioteca|Biblioth|Libreria|Active|Inactive|Activo|Inactivo|Actif|Inactif|Aktiv|Inaktiv|Attivo|Inattivo|Ativo|Inativo|Started\s+running|Sponsored|Publicidad|Sponsoris|Gesponsert)/i.test(ctx);
    if (hasAdSignal) {
      let extractedId = contextualMatch[1];
      const afterMatch = clean.slice((contextualMatch.index ?? 0) + contextualMatch[0].length);

      const monthMatch = afterMatch.match(multiLocaleMonthRegex);
      if (monthMatch && extractedId.length >= 13) {
        const lastTwo = extractedId.slice(-2);
        const lastOne = extractedId.slice(-1);
        const numTwo = parseInt(lastTwo, 10);
        const numOne = parseInt(lastOne, 10);
        if (numTwo >= 1 && numTwo <= 31 && extractedId.length - 2 >= 12) {
          extractedId = extractedId.slice(0, -2);
        } else if (numOne >= 1 && numOne <= 9 && extractedId.length - 1 >= 12) {
          extractedId = extractedId.slice(0, -1);
        }
      } else if (/^[A-Za-z]/.test(afterMatch)) {
        return {
          id: extractedId,
          rawLabel: 'ID (Contextual)',
          confidence: 'LOW',
          isAmbiguous: true,
          ambiguityReason: `Ambiguous boundary: digits directly fused into non-digit token "${afterMatch.slice(0, 15)}"`,
          rawExtracted: contextualMatch[0]
        };
      }

      return {
        id: extractedId,
        rawLabel: 'ID (Contextual)',
        confidence: 'LOW'
      };
    }
  }

  return null;
}

/**
 * Discovers candidate card root element via bounded ancestor traversal.
 * Avoids rigid parent hop assumptions and uses structural boundaries:
 * Stops before body/nav/forms and before stepping into outer feed containers that enclose multiple cards.
 */
export function findCandidateCardRoot(
  idEl: HTMLElement,
  doc: Document
): { cardRoot: HTMLElement | null; outcome: CardValidationOutcome; reason?: string } {
  const MAX_TRAVERSAL_DEPTH = 20;
  let current: HTMLElement = idEl;
  let bestCardRoot: HTMLElement | null = null;
  let depth = 0;

  while (current && current.parentElement && depth < MAX_TRAVERSAL_DEPTH) {
    const parent = current.parentElement;
    depth++;

    // Terminate if reaching body, documentElement or layout boundaries
    if (parent === doc.body || parent === doc.documentElement) {
      break;
    }

    const parentTag = (parent.tagName || '').toUpperCase();
    if (parentTag === 'NAV' || parentTag === 'HEADER' || parentTag === 'FORM') {
      break;
    }

    // Terminate if parent contains global search inputs or navigation controls
    if (parent.querySelector('input[type="search"], form[role="search"], nav')) {
      break;
    }

    // Key invariant: Count ad identifiers enclosed by parent.
    // If parent contains multiple distinct ad library IDs, parent is the feed container!
    // The card root MUST be 'current' (the child), not the multi-card feed parent!
    const parentText = parent.textContent || '';
    const idMatches = parentText.match(/(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*[0-9]+/gi);
    if (idMatches && idMatches.length > 1) {
      if (!bestCardRoot) {
        bestCardRoot = current;
      }
      break;
    }

    // Check if current candidate has card structural attributes
    const hasLinks = current.querySelectorAll('a').length > 0;
    const hasRoleArticle = current.getAttribute('role') === 'article';
    const hasCardClass = typeof current.className === 'string' && /(?:card|ad-card|result-card)/i.test(current.className);
    const hasAdvertiserSignal = /(?:Sponsored|Publicidad|Sponsoris|Gesponsert|Started\s+running|En\s+circulaci[oó]n)/i.test(current.textContent || '');

    if (hasRoleArticle || (hasLinks && hasAdvertiserSignal) || hasCardClass) {
      bestCardRoot = current;
    }

    current = parent;
  }

  const finalRoot = bestCardRoot || current || idEl;
  if (!finalRoot) {
    return { cardRoot: null, outcome: 'INVALID_CONTAINER', reason: 'No card container found' };
  }

  return { cardRoot: finalRoot, outcome: 'VALID_CANDIDATE' };
}

/**
 * Validates candidate card node and ad identifier.
 */
export function validateAdCardCandidate(
  cardRoot: HTMLElement | null,
  libraryId: string,
  seenIds: Set<string>
): { isValid: boolean; outcome: CardValidationOutcome; reason?: string } {
  if (!libraryId || !/^[0-9]{5,25}$/.test(libraryId)) {
    return { isValid: false, outcome: 'MISSING_IDENTIFIER', reason: 'Invalid or missing library ID' };
  }

  if (seenIds.has(libraryId)) {
    return { isValid: false, outcome: 'DUPLICATE_CANDIDATE', reason: `Duplicate library ID: ${libraryId}` };
  }

  if (!cardRoot) {
    return { isValid: false, outcome: 'INVALID_CONTAINER', reason: 'Card container element is null' };
  }

  // Ensure cardRoot does not enclose multiple different IDs (which would indicate feed leakage)
  const text = cardRoot.textContent || '';
  const idMatches = text.match(/(?:Library\s+ID|ID\s+de\s+la\s+biblioteca|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca)\s*:\s*([0-9]+)/gi);
  if (idMatches && idMatches.length > 1) {
    const uniqueIds = new Set(idMatches.map(m => m.replace(/[^0-9]/g, '')));
    if (uniqueIds.size > 1) {
      return { isValid: false, outcome: 'INVALID_CONTAINER', reason: 'Container encapsulates multiple ad cards' };
    }
  }

  return { isValid: true, outcome: 'VALID_CANDIDATE' };
}

/**
 * Extracts normalized ad candidate fields from a validated ad card container.
 */
export function extractFieldsFromCard(
  cardRoot: HTMLElement,
  libraryId: string,
  observedKeyword?: string
): ScrapedAdCandidate {
  // Prefer authoritative Ad Library ID from verifiable link if present within the card
  const adDetailLink = cardRoot.querySelector('a[href*="/ads/library/?id="], a[href*="/ads/library/"]');
  if (adDetailLink) {
    const href = (adDetailLink as HTMLAnchorElement).href || '';
    const match = href.match(/[?&]id=([0-9]{5,25})/i);
    if (match && match[1]) {
      libraryId = match[1];
    }
  }

  const cardFullText = cardRoot.innerText || cardRoot.textContent || '';

  // Status: Active vs Inactive across locales
  const inactiveRegex = /(?:Inactive|Inactivo|Inactif|Inaktiv|Inattivo|Inativo)/i;
  const activeRegex = /(?:Active|Activo|Actif|Aktiv|Attivo|Ativo)/i;
  const isActive = !inactiveRegex.test(cardFullText) && (activeRegex.test(cardFullText) || true);

  // Started running date across locales
  let startedRunning = '';
  const datePatterns = [
    /Started running on ([^\n~·]+)/i,
    /En circulaci[oó]n desde el ([^\n~·]+)/i,
    /En circulation depuis le ([^\n~·]+)/i,
    /Seit ([^\n~·]+) aktiv/i,
    /Inizio pubblicazione:?\s*([^\n~·]+)/i,
    /Veicula[çc][aã]o iniciada em ([^\n~·]+)/i,
    /([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4}\s*-\s*[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})/i
  ];
  for (const pattern of datePatterns) {
    const match = cardFullText.match(pattern);
    if (match) {
      startedRunning = match[1].trim();
      break;
    }
  }

  // Has multiple versions
  const hasMultipleVersions = /(?:multiple versions|plusieurs versions|m[uú]ltiples versiones|mehrere Versionen|pi[uù] versioni|v[aá]rias vers[oõ]es)/i.test(cardFullText);

  // Page Name and Facebook Page URL
  let pageName = 'Unknown Advertiser';
  let facebookPageUrl: string | undefined;
  let facebookPageId: string | undefined;

  const links = Array.from(cardRoot.querySelectorAll('a'));

  // Scan links for Facebook page link
  for (const link of links) {
    const href = link.href || '';
    const linkText = link.innerText || link.textContent || '';
    const fbInfo = extractFacebookPageInfo(href, linkText);
    if (fbInfo.pageUrl) {
      facebookPageUrl = fbInfo.pageUrl;
      if (linkText && linkText.trim() && (!pageName || pageName === 'Unknown Advertiser')) {
        pageName = linkText.trim();
      }
      const idMatch = fbInfo.pageUrl.match(/facebook\.com\/([0-9]{5,})/);
      if (idMatch) facebookPageId = idMatch[1];
      break;
    }
  }

  // Fallback for page name: search for text before "Sponsored" or localized badge
  if (pageName === 'Unknown Advertiser') {
    const sponsoredRegex = /(?:Sponsored|Publicidad|Sponsoris[eé]|Gesponsert|Sponsorizzato|Patrocinado)/i;
    const match = cardFullText.match(sponsoredRegex);
    if (match && typeof match.index === 'number' && match.index > 0) {
      const textBefore = cardFullText.substring(0, match.index).trim();
      const lines = textBefore.split('\n').map(l => l.trim()).filter(Boolean);
      const lastLine = lines.pop();
      if (lastLine && lastLine.length > 1 && !lastLine.includes('Library ID') && !lastLine.includes('Active')) {
        pageName = lastLine;
      }
    }
  }

  // Extract Destination Website URL & Domain
  let destinationUrl: string | undefined;
  let destinationDomain: string | undefined;
  let ctaText: string | undefined;

  for (const link of links) {
    const href = link.href || '';
    const dest = extractUrlFromShim(href);
    if (dest.destinationUrl) {
      destinationUrl = dest.destinationUrl;
      destinationDomain = dest.domain;
      const text = (link.innerText || link.textContent || '').trim();
      if (text && text.length < 50) {
        ctaText = text.split('\n').pop()?.trim();
      }
      break;
    }
  }

  // CTA Text fallback (common buttons across locales)
  if (!ctaText) {
    const ctaPatterns = [
      'Learn more', 'Shop Now', 'Sign Up', 'Contact Us', 'Apply Now', 'Book Now', 'Get Quote', 'Download',
      'M[aá]s informaci[oó]n', 'En savoir plus', 'Mehr dazu', 'Scopri di pi[uù]', 'Saiba mais'
    ];
    for (const pattern of ctaPatterns) {
      if (cardFullText.includes(pattern)) {
        ctaText = pattern;
        break;
      }
    }
  }

  // Body copy snippet
  let bodyCopy = '';
  const bodyMatch = cardFullText.match(/(?:Sponsored|Publicidad|Sponsoris[eé]|Gesponsert|Sponsorizzato|Patrocinado)\s*\n([\s\S]{10,350})/i);
  if (bodyMatch) {
    bodyCopy = bodyMatch[1].trim().replace(/\n+/g, ' ');
  } else {
    bodyCopy = cardFullText.substring(0, 200).replace(/\n+/g, ' ');
  }

  // Extract public contact data (phones, emails) from card DOM and links (Phase 7)
  const contactData = extractContactsFromAdCard(cardRoot, libraryId);
  const observedPhones = contactData.phones;
  const observedEmails = contactData.emails;
  const contactObservations = [...observedPhones, ...observedEmails];

  return {
    libraryId,
    pageName,
    facebookPageUrl,
    facebookPageId,
    destinationUrl,
    destinationDomain,
    isActive,
    startedRunning,
    hasMultipleVersions,
    bodyCopy: bodyCopy.substring(0, 300),
    ctaText,
    observedKeyword,
    rawText: cardFullText.substring(0, 200),
    observedPhones,
    observedEmails,
    contactObservations
  };
}

/**
 * Robust extraction with full diagnostic accounting.
 */
export function extractAdCardsWithDiagnostics(
  doc: Document,
  observedKeyword?: string,
  options?: { seenLibraryIds?: Set<string>; scrollIteration?: number; relevantMutationsObserved?: number }
): AdExtractionResult {
  const startTime = Date.now();
  const candidates: ScrapedAdCandidate[] = [];
  const seenLibraryIds = options?.seenLibraryIds ? new Set(options.seenLibraryIds) : new Set<string>();
  const diagnosticDetails: Array<{ libraryId?: string; outcome: CardValidationOutcome; reason?: string }> = [];

  let cardsExamined = 0;
  let identifierCandidatesFound = 0;
  let cardsRejectedMissingId = 0;
  let duplicateCardsIgnored = 0;

  try {
    // 1. Check for Bot Challenge / Login Wall
    const challenge = checkForBotChallenge(doc);
    if (challenge.isBlocked) {
      return {
        candidates: [],
        diagnostics: {
          cardsExamined: 0,
          identifierCandidatesFound: 0,
          validCardsAccepted: 0,
          cardsRejectedMissingId: 0,
          duplicateCardsIgnored: 0,
          extractionDurationMs: Date.now() - startTime,
          scrollIteration: options?.scrollIteration,
          relevantMutationsObserved: options?.relevantMutationsObserved
        },
        status: challenge.code || 'CHALLENGED'
      };
    }

    // 2. Discover identifier candidate elements
    const idCandidates: Array<{ idEl: HTMLElement; idInfo: ExtractedIdentifierResult }> = [];

    // Priority 1: Discover verified Ad Library detail links (highest specificity & authority)
    const detailLinks = Array.from(doc.querySelectorAll('a[href*="/ads/library/"]'));
    for (const link of detailLinks) {
      const href = (link as HTMLAnchorElement).href || '';
      const urlMatch = href.match(/[?&]id=([0-9]{5,25})/i);
      if (urlMatch && urlMatch[1]) {
        const id = urlMatch[1];
        if (!idCandidates.some(c => c.idEl === link)) {
          idCandidates.push({
            idEl: link as HTMLElement,
            idInfo: { id, rawLabel: 'Ad Detail Link ID', confidence: 'HIGH' }
          });
        }
      }
    }

    // Priority 2: Discover innermost leaf text elements containing Library ID label
    const allElements = Array.from(doc.querySelectorAll('div, span, p, a, strong, b'));
    for (const el of allElements) {
      const htmlEl = el as HTMLElement;
      const text = htmlEl.textContent;
      if (!text || text.length > 250) continue;
      if (!/(?:ID|Identifiant|Bibliothek|Identyfikator|Biblioteka|Libreria)/i.test(text)) continue;

      // CRITICAL: Strictly isolate innermost leaf elements.
      // If ANY descendant element also contains the identifier, the child is the specific
      // leaf container, and evaluating this ancestor element will concatenate adjacent sibling
      // text nodes (such as dates '18 Nov' or version counts), producing corrupted/concatenated IDs.
      const hasMatchingChild = (node: HTMLElement): boolean => {
        if (!node.children || node.children.length === 0) return false;
        for (const child of Array.from(node.children)) {
          const childText = child.textContent || '';
          if (/(?:ID|Identifiant|Bibliothek|Identyfikator|Biblioteka|Libreria)/i.test(childText) &&
              extractAdIdentifier(childText, { surroundingText: child.parentElement?.textContent || '' }) !== null) {
            return true;
          }
          if (hasMatchingChild(child as HTMLElement)) return true;
        }
        return false;
      };
      if (hasMatchingChild(htmlEl)) continue;

      const parentText = htmlEl.parentElement ? (htmlEl.parentElement.textContent || '') : '';
      const idInfo = extractAdIdentifier(text, { surroundingText: parentText });
      if (idInfo) {
        const isRedundantInternal = idCandidates.some(c => {
          if (c.idEl === htmlEl) return true;
          if (c.idInfo.id === idInfo.id) {
            return Boolean(c.idEl.contains?.(htmlEl) || htmlEl.contains?.(c.idEl));
          }
          return false;
        });
        if (!isRedundantInternal) {
          idCandidates.push({ idEl: htmlEl, idInfo });
        }
      } else {
        // Detect malformed identifier labels
        const malformedMatch = text.match(/(?:Library\s+ID|Ad\s+Library\s+ID|Identifiant\s+de\s+la\s+biblioth[eè]que|Bibliotheks-?ID|ID\s+della\s+libreria|ID\s+da\s+biblioteca|ID\s+de\s+la\s+biblioteca|Bibliotheek-?ID|Identyfikator\s+(?:w\s+)?Bibliotece)\s*:\s*(\S*)/i);
        if (malformedMatch) {
          const extractedVal = malformedMatch[1]?.trim() || '';
          idCandidates.push({
            idEl: htmlEl,
            idInfo: {
              id: extractedVal,
              rawLabel: malformedMatch[0],
              confidence: 'LOW',
              isAmbiguous: true,
              ambiguityReason: `Malformed or missing identifier digits: "${extractedVal}"`
            }
          });
        }
      }
    }

    // Priority 3: Check for structural ad card containers in the DOM that have no identifier
    const structuralCards = Array.from(doc.querySelectorAll('article, [role="article"], div[class*="ad-card"], div[class*="result-card"]'));
    for (const cardEl of structuralCards) {
      const htmlCard = cardEl as HTMLElement;
      const alreadyHasCandidate = idCandidates.some(c => htmlCard.contains?.(c.idEl) || htmlCard === c.idEl);
      if (!alreadyHasCandidate) {
        const hasAdSignal = /(?:Sponsored|Publicidad|Sponsoris|Gesponsert|Started\s+running)/i.test(htmlCard.textContent || '');
        if (hasAdSignal) {
          idCandidates.push({
            idEl: htmlCard,
            idInfo: {
              id: '',
              rawLabel: 'Unidentified Card Container',
              confidence: 'LOW',
              isAmbiguous: true,
              ambiguityReason: 'Ad card container has no identifiable Library ID'
            }
          });
        }
      }
    }

    identifierCandidatesFound = idCandidates.length;

    // 3. Process each identifier candidate with physical card root deduplication
    const seenCardRoots = new Set<HTMLElement>();

    for (const { idEl, idInfo } of idCandidates) {
      cardsExamined++;
      const { id: libraryId } = idInfo;

      if (!libraryId || idInfo.isAmbiguous) {
        cardsRejectedMissingId++;
        diagnosticDetails.push({
          libraryId: libraryId || 'UNKNOWN',
          outcome: !libraryId ? 'MISSING_IDENTIFIER' : 'AMBIGUOUS_CANDIDATE',
          reason: idInfo.ambiguityReason || 'Ambiguous identifier boundary without corroborating source'
        });
        continue;
      }

      if (seenLibraryIds.has(libraryId)) {
        duplicateCardsIgnored++;
        diagnosticDetails.push({ libraryId, outcome: 'DUPLICATE_CANDIDATE', reason: 'Identifier already seen in run' });
        continue;
      }

      // Discover container using bounded traversal
      const containerResult = findCandidateCardRoot(idEl, doc);
      if (!containerResult.cardRoot) {
        cardsRejectedMissingId++;
        diagnosticDetails.push({ libraryId, outcome: containerResult.outcome, reason: containerResult.reason });
        continue;
      }

      // Prevent multiple extractions from the same physical card root in the same scan pass
      if (seenCardRoots.has(containerResult.cardRoot)) {
        duplicateCardsIgnored++;
        diagnosticDetails.push({ libraryId, outcome: 'DUPLICATE_CANDIDATE', reason: 'Physical card root already extracted in current scan pass' });
        continue;
      }

      // Validate candidate container
      const valResult = validateAdCardCandidate(containerResult.cardRoot, libraryId, seenLibraryIds);
      if (!valResult.isValid) {
        diagnosticDetails.push({ libraryId, outcome: valResult.outcome, reason: valResult.reason });
        if (valResult.outcome === 'DUPLICATE_CANDIDATE') duplicateCardsIgnored++;
        else cardsRejectedMissingId++;
        continue;
      }

      seenCardRoots.add(containerResult.cardRoot);

      // Extract fields (with verified detail link if card has one)
      try {
        const candidate = extractFieldsFromCard(containerResult.cardRoot, libraryId, observedKeyword);
        candidates.push(candidate);
        seenLibraryIds.add(candidate.libraryId);
        diagnosticDetails.push({ libraryId: candidate.libraryId, outcome: 'VALID_CANDIDATE' });
      } catch (cardErr: any) {
        cardsRejectedMissingId++;
        diagnosticDetails.push({
          libraryId,
          outcome: 'PARSING_FAILED',
          reason: cardErr?.message || 'Field extraction failed'
        });
      }
    }

    const duration = Date.now() - startTime;
    let status: ExtractionResultStatus = 'NO_NEW_RESULTS_OBSERVED';
    if (candidates.length > 0) {
      status = 'RESULTS_FOUND';
    } else if (cardsRejectedMissingId > 0 && duplicateCardsIgnored === 0) {
      status = 'EXTRACTION_ERROR';
    }

    return {
      candidates,
      diagnostics: {
        cardsExamined,
        identifierCandidatesFound,
        validCardsAccepted: candidates.length,
        cardsRejectedMissingId,
        duplicateCardsIgnored,
        extractionDurationMs: duration,
        scrollIteration: options?.scrollIteration,
        relevantMutationsObserved: options?.relevantMutationsObserved,
        details: diagnosticDetails
      },
      status
    };
  } catch (err: any) {
    return {
      candidates,
      diagnostics: {
        cardsExamined,
        identifierCandidatesFound,
        validCardsAccepted: candidates.length,
        cardsRejectedMissingId,
        duplicateCardsIgnored,
        extractionDurationMs: Date.now() - startTime,
        scrollIteration: options?.scrollIteration,
        relevantMutationsObserved: options?.relevantMutationsObserved,
        details: [
          ...diagnosticDetails,
          { outcome: 'INVALID_CONTAINER', reason: err?.message || 'Extraction exception' }
        ]
      },
      status: candidates.length > 0 ? 'RESULTS_FOUND' : 'EXTRACTION_ERROR'
    };
  }
}

/**
 * Backward-compatible entrypoint: Extracts valid ad cards from a Document.
 */
export function extractAdCardsFromDocument(doc: Document, observedKeyword?: string): ScrapedAdCandidate[] {
  return extractAdCardsWithDiagnostics(doc, observedKeyword).candidates;
}

/**
 * Deduplicates and aggregates candidates into clean, unified lead records.
 * If intent is provided, candidates are strictly evaluated for relevance:
 * RELEVANT candidates are accepted, while NOT_RELEVANT and UNCERTAIN candidates are filtered out.
 */
export function aggregateCandidatesToLeads(
  candidates: ScrapedAdCandidate[],
  locationCode: string | ResearchIntent = 'US',
  locationName: string = 'United States',
  maxResults: number = MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH,
  existingLeads: ExtensionLead[] = [],
  intent?: ResearchIntent
): {
  leads: ExtensionLead[];
  totalAdsCount: number;
  rejectedCount: number;
  uncertainCount: number;
  evaluatedCount: number;
  counters: {
    rawAds: number;
    normalizedCandidates: number;
    relevantCandidates: number;
    uncertainCandidates: number;
    notRelevantCandidates: number;
    duplicatesRemoved: number;
    finalUniqueLeads: number;
    reasonCodes: Record<string, number>;
  };
} {
  let effectiveLocationCode = 'US';
  let effectiveLocationName = typeof locationName === 'string' ? locationName : 'United States';
  let resolvedIntent = intent;

  if (typeof locationCode === 'object' && locationCode !== null) {
    resolvedIntent = locationCode as ResearchIntent;
    effectiveLocationCode = resolvedIntent.locationCode || 'US';
  } else if (typeof locationCode === 'string' && locationCode) {
    effectiveLocationCode = locationCode;
  }

  const effectiveCeiling = typeof maxResults === 'number' && maxResults > 0
    ? Math.min(maxResults, MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH)
    : MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH;

  const actualExistingLeads = Array.isArray(existingLeads) ? existingLeads : [];
  const actualIntent = resolvedIntent || (!Array.isArray(existingLeads) && typeof existingLeads === 'object' ? existingLeads as unknown as ResearchIntent : undefined);

  // Group all candidates by authoritative entity resolution key
  const candidateGroups = new Map<string, ScrapedAdCandidate[]>();
  const entityIndex = new EntityResolutionIndex();
  const indexLeadMap = new Map<string, ExtensionLead>();
  let totalAdsCount = 0;
  const reasonCodes: Record<string, number> = {};

  // Pre-index existing leads so incoming candidates match them by Page ID / Page Slug / Domain / Name
  for (const lead of actualExistingLeads) {
    if (!lead.destinationDomain && lead.destinationUrl) {
      const dNorm = normalizeDestinationDomain(lead.destinationUrl);
      if (dNorm.canonicalDomain) lead.destinationDomain = dNorm.canonicalDomain;
    }
    const key = lead.canonicalPageId
      ? `fb_${lead.canonicalPageId}`
      : (lead.canonicalPageSlug ? `fbslug_${lead.canonicalPageSlug}` : (lead.canonicalName ? `name_${getComparisonNameKey(lead.canonicalName)}` : lead.name.toLowerCase()));
    indexLeadMap.set(key, lead);
    entityIndex.indexEntity(key, lead);
  }

  // Track established domains and page IDs per name key to prevent conflicting merges
  const nameToGroupKey = new Map<string, string>();

  for (const cand of candidates) {
    totalAdsCount++;
    const cleanName = normalizeAdvertiserName(cand.pageName);
    if (!cleanName || cleanName === 'Unknown Advertiser') continue;

    const pageNorm = normalizeFacebookPage(cand.facebookPageUrl, cand.facebookPageId || (cand as any).pageId);
    const domainNorm = normalizeDestinationDomain(cand.destinationUrl, cand.destinationDomain);
    const compName = getComparisonNameKey(cleanName);

    let groupKey: string;

    // 1. Stable Page ID match (highest precedence)
    if (pageNorm.pageId) {
      if (entityIndex.pageIdToKey.has(pageNorm.pageId)) {
        groupKey = entityIndex.pageIdToKey.get(pageNorm.pageId)!;
      } else {
        groupKey = `fb_${pageNorm.pageId}`;
      }
    }
    // 2. Stable Page Slug match
    else if (pageNorm.pageSlug) {
      if (entityIndex.pageSlugToKey.has(pageNorm.pageSlug)) {
        groupKey = entityIndex.pageSlugToKey.get(pageNorm.pageSlug)!;
      } else {
        groupKey = `fbslug_${pageNorm.pageSlug}`;
      }
    }
    // 3. Short generic name without Page ID -> never merge unless exact domain match
    else if (isShortGenericName(cleanName)) {
      if (domainNorm.canonicalDomain && !domainNorm.isSharedMarketplace) {
        const nameDomKey = `${compName}__${domainNorm.canonicalDomain}`;
        if (entityIndex.nameDomainToKey.has(nameDomKey)) {
          groupKey = entityIndex.nameDomainToKey.get(nameDomKey)!;
        } else {
          groupKey = `dom_${compName}_${domainNorm.canonicalDomain}`;
        }
      } else {
        groupKey = `unres_${compName}_${cand.libraryId}`;
      }
    }
    // 4. Non-generic brand name
    else {
      // Check if existing group exists for this comparison name
      const existingKeyForName = nameToGroupKey.get(compName) || entityIndex.specificNameToKey.get(compName);
      if (existingKeyForName && indexLeadMap.has(existingKeyForName)) {
        const existingLead = indexLeadMap.get(existingKeyForName)!;
        const existingPage = normalizeFacebookPage(existingLead.facebookPageUrl, existingLead.canonicalPageId);
        const existingDomain = existingLead.destinationDomain;

        // Check for conflicts:
        const hasPageConflict = Boolean(
          (pageNorm.pageId && existingPage.pageId && pageNorm.pageId !== existingPage.pageId) ||
          (pageNorm.pageSlug && existingPage.pageSlug && pageNorm.pageSlug !== existingPage.pageSlug)
        );
        const hasDomainConflict = Boolean(
          domainNorm.canonicalDomain &&
          existingDomain &&
          !domainNorm.isSharedMarketplace &&
          !GENERIC_SHARED_DOMAINS.has(existingDomain) &&
          domainNorm.canonicalDomain !== existingDomain
        );

        if (!hasPageConflict && !hasDomainConflict) {
          groupKey = existingKeyForName;
        } else {
          // Conflict detected! Create distinct entity
          groupKey = domainNorm.canonicalDomain
            ? `dom_${compName}_${domainNorm.canonicalDomain}`
            : `cand_${compName}_${cand.libraryId}`;
        }
      } else {
        groupKey = `name_${compName}`;
      }
    }

    const group = candidateGroups.get(groupKey) || [];
    group.push(cand);
    candidateGroups.set(groupKey, group);

    // If new group, index mock lead and register name
    if (!indexLeadMap.has(groupKey)) {
      const mockLead: Partial<ExtensionLead> = {
        name: cleanName,
        canonicalName: cleanName,
        canonicalPageId: pageNorm.pageId,
        canonicalPageSlug: pageNorm.pageSlug,
        facebookPageUrl: cand.facebookPageUrl,
        destinationUrl: domainNorm.cleanUrl || cand.destinationUrl,
        destinationDomain: domainNorm.canonicalDomain
      };
      indexLeadMap.set(groupKey, mockLead as ExtensionLead);
      entityIndex.indexEntity(groupKey, mockLead as ExtensionLead);
      if (!isShortGenericName(cleanName) && compName) {
        nameToGroupKey.set(compName, groupKey);
      }
    } else {
      // If candidate has stronger domain or page info, enrich the indexed lead
      const existingLead = indexLeadMap.get(groupKey)!;
      if (!existingLead.canonicalPageId && pageNorm.pageId) {
        existingLead.canonicalPageId = pageNorm.pageId;
        entityIndex.pageIdToKey.set(pageNorm.pageId, groupKey);
      }
      if (!existingLead.canonicalPageSlug && pageNorm.pageSlug) {
        existingLead.canonicalPageSlug = pageNorm.pageSlug;
        entityIndex.pageSlugToKey.set(pageNorm.pageSlug, groupKey);
      }
      if (!existingLead.destinationDomain && domainNorm.canonicalDomain) {
        existingLead.destinationDomain = domainNorm.canonicalDomain;
        if (compName && !domainNorm.isSharedMarketplace) {
          entityIndex.nameDomainToKey.set(`${compName}__${domainNorm.canonicalDomain}`, groupKey);
        }
      }
    }
  }

  const leadMap = new Map<string, ExtensionLead>();

  // Initialize with existing leads
  for (const lead of actualExistingLeads) {
    const key = lead.canonicalPageId
      ? `fb_${lead.canonicalPageId}`
      : (lead.canonicalPageSlug ? `fbslug_${lead.canonicalPageSlug}` : (lead.canonicalName ? `name_${getComparisonNameKey(lead.canonicalName)}` : lead.name.toLowerCase()));
    leadMap.set(key, { ...lead });
  }

  let rejectedCount = 0;
  let uncertainCount = 0;
  let evaluatedCount = 0;

  for (const [key, cands] of candidateGroups.entries()) {
    evaluatedCount++;
    const primaryCand = cands[0];
    const cleanName = primaryCand.pageName.trim();

    // 1. Evaluate relevance if research intent is provided
    const evalResult = actualIntent ? LeadRelevanceEngine.evaluateEntity(cleanName, cands, actualIntent) : null;

    if (actualIntent && evalResult) {
      const code = evalResult.reasonCode || 'UNKNOWN';
      reasonCodes[code] = (reasonCodes[code] || 0) + 1;

      if (evalResult.decision === 'NOT_RELEVANT') {
        rejectedCount++;
        continue;
      }
      if (evalResult.decision === 'UNCERTAIN') {
        uncertainCount++;
        // Strict Gate v2 policy: UNCERTAIN candidates are excluded from final accepted leads
        continue;
      }
    }

    // 2. Evaluate geographic physical origin
    const combinedBodyCopy = cands.map(c => c.bodyCopy).filter(Boolean).join(' ');
    const combinedCta = cands.map(c => c.ctaText).filter(Boolean).join(' ');
    const bestFbForGeo = cands.find(c => Boolean(c.facebookPageUrl))?.facebookPageUrl;
    const bestDestForGeo = cands.find(c => Boolean(c.destinationUrl));
    const geoEval = evaluateGeographicOrigin({
      pageName: cleanName,
      pageUrl: bestFbForGeo,
      destinationUrl: bestDestForGeo?.destinationUrl,
      destinationDomain: bestDestForGeo?.destinationDomain,
      bodyCopy: combinedBodyCopy,
      ctaText: combinedCta
    }, effectiveLocationCode);

    // 2.5. Classify CTA and Destination for each candidate and build ad-level evidence
    const candsAdEvidence: AdLevelEvidence[] = cands.map(cand => {
      const ctaRes = cand.ctaType
        ? { ctaType: cand.ctaType, rawCtaText: cand.ctaText, originalCtaText: cand.ctaText, normalizedText: cand.ctaText || '', status: 'CLASSIFIED' as const, confidence: 'HIGH' as const, evidence: 'Pre-classified CTA intent.', reasonCode: 'CTA_TEXT_MATCH', reason: '' }
        : classifyCta(cand.ctaText);
      const destRes = cand.destinationType
        ? { destinationType: cand.destinationType, confidence: cand.destinationConfidence || 'HIGH', reasonCode: cand.destinationReasonCode || 'VISIBLE_EXTERNAL_DESTINATION', reason: '' }
        : classifyDestination({
            destinationUrl: cand.destinationUrl,
            destinationDomain: cand.destinationDomain,
            ctaText: cand.ctaText,
            ctaType: ctaRes.ctaType,
            bodyCopy: cand.bodyCopy,
            rawText: cand.rawText
          });

      cand.ctaType = ctaRes.ctaType;
      cand.destinationType = destRes.destinationType;
      cand.destinationReasonCode = destRes.reasonCode;
      cand.destinationConfidence = destRes.confidence;

      return {
        libraryId: cand.libraryId,
        ctaText: cand.ctaText,
        normalizedCtaText: ctaRes.normalizedText,
        ctaConfidence: ctaRes.confidence,
        ctaStatus: ctaRes.status,
        ctaType: ctaRes.ctaType,
        destinationType: destRes.destinationType,
        destinationUrl: cand.destinationUrl,
        destinationDomain: cand.destinationDomain,
        reasonCode: destRes.reasonCode,
        confidence: destRes.confidence,
        observedAt: cand.startedRunning || new Date().toISOString(),
        contactObservations: cand.contactObservations || [
          ...(cand.observedPhones || []),
          ...(cand.observedEmails || [])
        ]
      };
    });

    const seenCandidateLibIds = new Set<string>();
    const uniqueCandsAdEvidence: AdLevelEvidence[] = [];
    for (const item of candsAdEvidence) {
      if (item.libraryId && seenCandidateLibIds.has(item.libraryId)) continue;
      if (item.libraryId) seenCandidateLibIds.add(item.libraryId);
      uniqueCandsAdEvidence.push(item);
    }

    const candSummary = aggregateAdEvidence(uniqueCandsAdEvidence);

    // Filter by user-configured CTA type requirements (if specified)
    if (actualIntent?.requiredCtaTypes && actualIntent.requiredCtaTypes.length > 0) {
      const hasMatchingCta = candSummary.observedCtaTypes.some(t => actualIntent.requiredCtaTypes!.includes(t));
      if (!hasMatchingCta) {
        rejectedCount++;
        reasonCodes['CTA_FILTER_MISMATCH'] = (reasonCodes['CTA_FILTER_MISMATCH'] || 0) + 1;
        continue;
      }
    }

    // Filter by user-configured Destination type requirements (if specified)
    if (actualIntent?.requiredDestinationTypes && actualIntent.requiredDestinationTypes.length > 0) {
      const effectiveReqDests = actualIntent.requiredDestinationTypes.map(d => (d === ('APP_STORE' as any) ? 'APP' : d));
      const hasMatchingDest = candSummary.observedDestinationTypes.some(t => effectiveReqDests.includes(t));
      if (!hasMatchingDest) {
        rejectedCount++;
        reasonCodes['DESTINATION_FILTER_MISMATCH'] = (reasonCodes['DESTINATION_FILTER_MISMATCH'] || 0) + 1;
        continue;
      }
    }

    if (actualIntent?.strictLocalMode) {
      if (geoEval.classification === 'FOREIGN_VERIFIED') {
        rejectedCount++;
        reasonCodes['FOREIGN_BUSINESS'] = (reasonCodes['FOREIGN_BUSINESS'] || 0) + 1;
        continue;
      }
      if (geoEval.classification === 'LOCATION_UNKNOWN') {
        uncertainCount++;
        reasonCodes['LOCATION_UNKNOWN'] = (reasonCodes['LOCATION_UNKNOWN'] || 0) + 1;
        continue;
      }
      if (geoEval.classification === 'LOCAL_PROBABLE' && actualIntent.allowProbableLocal === false) {
        uncertainCount++;
        reasonCodes['LOCAL_PROBABLE_DISALLOWED'] = (reasonCodes['LOCAL_PROBABLE_DISALLOWED'] || 0) + 1;
        continue;
      }
    }

    // 3. Candidate is RELEVANT (or no intent was provided for raw aggregation)
    const existing = leadMap.get(key);

    if (existing) {
      if (!existing.canonicalPageId) {
        const foundId = cands.find(c => c.facebookPageId || (c as any).pageId)?.facebookPageId || (cands.find(c => (c as any).pageId) as any)?.pageId;
        if (foundId) existing.canonicalPageId = foundId;
      }
      if (!existing.canonicalPageSlug) {
        const foundUrl = cands.find(c => c.facebookPageUrl)?.facebookPageUrl;
        if (foundUrl) {
          const norm = normalizeFacebookPage(foundUrl, existing.canonicalPageId);
          if (norm.pageSlug) existing.canonicalPageSlug = norm.pageSlug;
        }
      }

      for (const cand of cands) {
        if (/^[0-9]{5,25}$/.test(cand.libraryId) && !existing.adLibraryIds.includes(cand.libraryId)) {
          existing.adLibraryIds.push(cand.libraryId);
        }
        if (cand.observedKeyword && !existing.matchedKeywords.includes(cand.observedKeyword)) {
          existing.matchedKeywords.push(cand.observedKeyword);
        }
        if (!existing.facebookPageUrl && cand.facebookPageUrl) {
          existing.facebookPageUrl = cand.facebookPageUrl;
          existing.facebookPageState = 'found';
        }
        if (!existing.destinationUrl && cand.destinationUrl) {
          existing.destinationUrl = cand.destinationUrl;
          existing.destinationDomain = cand.destinationDomain;
          existing.websiteState = 'found';
        }
        if (!existing.sampleCopy || (cand.bodyCopy && cand.bodyCopy.length > (existing.sampleCopy?.length || 0))) {
          existing.sampleCopy = cand.bodyCopy;
        }
        if (!existing.sampleCta && cand.ctaText) {
          existing.sampleCta = cand.ctaText;
        }
      }

      // Merge ad-level evidence
      if (!existing.adEvidence) existing.adEvidence = [];
      for (const item of candsAdEvidence) {
        const idx = existing.adEvidence.findIndex(e => e.libraryId === item.libraryId);
        if (idx >= 0) {
          existing.adEvidence[idx] = item;
        } else {
          existing.adEvidence.push(item);
        }
      }
      const existingSummary = aggregateAdEvidence(existing.adEvidence);
      existing.observedCtaTexts = existingSummary.observedCtaTexts;
      existing.observedCtaTypes = existingSummary.observedCtaTypes;
      existing.observedDestinationTypes = existingSummary.observedDestinationTypes;
      existing.primaryCtaType = existingSummary.primaryCtaType;
      existing.primaryDestinationType = existingSummary.primaryDestinationType;
      existing.destinationReasonCode = existingSummary.destinationReasonCode;
      existing.destinationConfidence = existingSummary.destinationConfidence;
      existing.adLibraryIds = sanitizeAdLibraryIds(existing.adLibraryIds);
      existing.adCount = existing.adLibraryIds.length;
      if (!existing.activeAdLibraryIds) {
        existing.activeAdLibraryIds = (typeof existing.activeAdCount === 'number' && existing.activeAdCount >= 0)
          ? existing.adLibraryIds.slice(0, existing.activeAdCount)
          : [...existing.adLibraryIds];
      }
      for (const cand of cands) {
        if (cand.isActive !== false && /^[0-9]{5,25}$/.test(cand.libraryId)) {
          if (!existing.activeAdLibraryIds.includes(cand.libraryId)) {
            existing.activeAdLibraryIds.push(cand.libraryId);
          }
        }
      }
      existing.activeAdLibraryIds = existing.activeAdLibraryIds.filter(id => existing.adLibraryIds.includes(id));
      existing.activeAdCount = existing.activeAdLibraryIds.length;

      // Update location intelligence if newly corroborated or if higher-precedence foreign/conflict signals emerge
      const shouldUpdateExistingGeo =
        !existing.geographicClassification ||
        existing.geographicClassification === 'LOCATION_UNKNOWN' ||
        geoEval.classification === 'FOREIGN_VERIFIED' ||
        (existing.geographicClassification === 'LOCAL_PROBABLE' && geoEval.classification === 'LOCAL_VERIFIED') ||
        geoEval.reasonCode === 'CONFLICTING_LOCATION_EVIDENCE';

      if (shouldUpdateExistingGeo) {
        existing.targetCountryCode = geoEval.targetCountryCode;
        existing.businessCountryCode = geoEval.businessCountryCode;
        existing.geographicClassification = geoEval.classification;
        existing.businessLocationConfidence = geoEval.confidence;
        existing.businessLocationEvidence = Array.from(new Set([
          ...(existing.businessLocationEvidence || []),
          ...geoEval.evidence
        ]));
        existing.businessLocationReason = geoEval.reason;
        existing.businessLocationReasonCode = geoEval.reasonCode;
      }

      // Update contact observations (Phase 7)
      const candsContacts = cands.flatMap(c => c.contactObservations || [
        ...(c.observedPhones || []),
        ...(c.observedEmails || [])
      ]);
      if (candsContacts.length > 0) {
        existing.contactProfile = mergeContactObservations(existing.contactProfile, candsContacts);
        existing.contactQualityState = existing.contactProfile.overallQualityState;
        existing.businessPhone = existing.contactProfile.primaryPhone;
        existing.businessEmail = existing.contactProfile.primaryEmail;
        existing.phones = existing.contactProfile.observedPhones.map(p => p.normalizedValue || p.rawValue);
        existing.emails = existing.contactProfile.observedEmails.map(e => e.normalizedValue || e.rawValue);
        existing.contactObservations = [...existing.contactProfile.observedPhones, ...existing.contactProfile.observedEmails];
      }

      if (evalResult) {
        existing.relevanceScore = Math.max(existing.relevanceScore || 0, evalResult.score);
        existing.relevanceDecision = evalResult.decision;
        existing.relevanceConfidence = evalResult.confidence;
        existing.relevanceReasons = evalResult.reasons;
        existing.relevanceMatchedTerms = evalResult.matchedTerms;
        existing.relevanceEvidence = evalResult.evidence;
        existing.relevanceStrategyVersion = evalResult.strategyVersion;
        existing.engineVersion = evalResult.engineVersion;
        existing.presetVersion = evalResult.presetVersion;
      }

      const qualGate = evaluateLeadQualificationGates(existing, actualIntent);
      existing.status = qualGate.status;
      existing.qualificationFailedGates = qualGate.failedGates;
      existing.qualificationReasons = qualGate.reasons;

      const priorityRes = calculateLeadScore(existing, actualIntent);
      existing.leadScore = priorityRes.score;
      existing.normalizedScore = priorityRes.normalizedScore;
      existing.prioritizationTier = priorityRes.tier;
      existing.scoreConfidence = priorityRes.confidence;
      existing.scoreBreakdown = priorityRes.breakdown;
      existing.scoreModelVersion = priorityRes.breakdown.modelVersion;
      existing.scoreExplanation = priorityRes.explanation;
    } else {
      if (leadMap.size >= effectiveCeiling) {
        // System ceiling reached for unique relevant leads
        continue;
      }

      // Consolidate best fields across candidate cards
      const bestFbUrl = cands.find(c => Boolean(c.facebookPageUrl))?.facebookPageUrl;
      const bestDestCand = cands.find(c => Boolean(c.destinationUrl));
      const bestDestUrl = bestDestCand?.destinationUrl;
      const bestDestDomain = bestDestCand?.destinationDomain;
      const bestCopy = cands.filter(c => Boolean(c.bodyCopy)).sort((a, b) => (b.bodyCopy?.length || 0) - (a.bodyCopy?.length || 0))[0]?.bodyCopy;
      const bestCta = cands.filter(c => Boolean(c.ctaText)).sort((a, b) => (b.ctaText?.length || 0) - (a.ctaText?.length || 0))[0]?.ctaText;

      const rawAdIds = Array.from(new Set(cands.map(c => c.libraryId).filter(id => /^[0-9]{5,25}$/.test(id))));
      const adIds = sanitizeAdLibraryIds(rawAdIds);
      const candidateActiveSet = new Set(
        cands.filter(c => c.isActive !== false).map(c => c.libraryId)
      );
      const activeIds = adIds.filter(id => candidateActiveSet.has(id));
      const matchedKws = Array.from(new Set(cands.map(c => c.observedKeyword).filter(Boolean) as string[]));

      const fbState = bestFbUrl ? 'found' : 'not_found';
      const webState = bestDestUrl ? 'found' : (candSummary.primaryDestinationType === 'NO_VISIBLE_DESTINATION' ? 'not_found' : 'unknown');

      const pageNorm = normalizeFacebookPage(bestFbUrl, cands.find(c => c.facebookPageId || (c as any).pageId)?.facebookPageId || (cands.find(c => (c as any).pageId) as any)?.pageId);
      const canonicalPageId = pageNorm.pageId;
      const canonicalPageSlug = pageNorm.pageSlug;

      const lead: ExtensionLead = {
        id: `lead_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        canonicalName: cleanName,
        canonicalPageId,
        canonicalPageSlug,
        identityConfidence: canonicalPageId || canonicalPageSlug ? 'STRONG' : (bestDestDomain ? 'MODERATE' : 'WEAK'),
        relationshipType: 'INDEPENDENT_BUSINESS',
        facebookPageName: cleanName,
        facebookPageUrl: bestFbUrl,
        facebookPageState: fbState,
        destinationUrl: bestDestUrl,
        destinationDomain: bestDestDomain,
        websiteState: webState,
        adCount: adIds.length,
        activeAdCount: activeIds.length,
        adLibraryIds: adIds,
        activeAdLibraryIds: activeIds,
        adLibraryUrl: adIds[0] ? `https://www.facebook.com/ads/library/?id=${adIds[0]}` : undefined,
        matchedKeywords: matchedKws.length > 0 ? matchedKws : (actualIntent?.primaryKeywords?.slice(0, 1) || []),
        locationCode: effectiveLocationCode,
        locationName: effectiveLocationName,
        // Ad-level CTA & Destination Intelligence (Phase 0.4)
        adEvidence: uniqueCandsAdEvidence,
        observedCtaTexts: candSummary.observedCtaTexts,
        observedCtaTypes: candSummary.observedCtaTypes,
        observedDestinationTypes: candSummary.observedDestinationTypes,
        primaryCtaType: candSummary.primaryCtaType,
        primaryDestinationType: candSummary.primaryDestinationType,
        destinationReasonCode: candSummary.destinationReasonCode,
        destinationConfidence: candSummary.destinationConfidence,
        targetCountryCode: geoEval.targetCountryCode,
        businessCountryCode: geoEval.businessCountryCode,
        geographicClassification: geoEval.classification,
        businessLocationConfidence: geoEval.confidence,
        businessLocationEvidence: geoEval.evidence,
        businessLocationReason: geoEval.reason,
        businessLocationReasonCode: geoEval.reasonCode,
        status: 'REVIEW_REQUIRED', // evaluated below via evaluateLeadQualificationGates
        discoveredAt: new Date().toISOString(),
        sampleCopy: bestCopy,
        sampleCta: bestCta,
        relevanceScore: evalResult?.score,
        relevanceDecision: evalResult?.decision,
        relevanceConfidence: evalResult?.confidence,
        relevanceReasons: evalResult?.reasons,
        relevanceMatchedTerms: evalResult?.matchedTerms,
        relevanceEvidence: evalResult?.evidence,
        relevanceStrategyVersion: evalResult?.strategyVersion,
        engineVersion: evalResult?.engineVersion,
        presetVersion: evalResult?.presetVersion
      };

      // Aggregate contact observations for new lead (Phase 7)
      const newCandsContacts = cands.flatMap(c => c.contactObservations || [
        ...(c.observedPhones || []),
        ...(c.observedEmails || [])
      ]);
      const newContactProfile = aggregateContactObservations(newCandsContacts);
      lead.contactProfile = newContactProfile;
      lead.contactQualityState = newContactProfile.overallQualityState;
      lead.businessPhone = newContactProfile.primaryPhone;
      lead.businessEmail = newContactProfile.primaryEmail;
      lead.phones = newContactProfile.observedPhones.map(p => p.normalizedValue || p.rawValue);
      lead.emails = newContactProfile.observedEmails.map(e => e.normalizedValue || e.rawValue);
      lead.contactObservations = newCandsContacts;

      const qualGate = evaluateLeadQualificationGates(lead, actualIntent);
      lead.status = qualGate.status;
      lead.qualificationFailedGates = qualGate.failedGates;
      lead.qualificationReasons = qualGate.reasons;

      const priorityRes = calculateLeadScore(lead, actualIntent);
      lead.leadScore = priorityRes.score;
      lead.normalizedScore = priorityRes.normalizedScore;
      lead.prioritizationTier = priorityRes.tier;
      lead.scoreConfidence = priorityRes.confidence;
      lead.scoreBreakdown = priorityRes.breakdown;
      lead.scoreModelVersion = priorityRes.breakdown.modelVersion;
      lead.scoreExplanation = priorityRes.explanation;

      leadMap.set(key, lead);
    }
  }

  const finalLeads = Array.from(leadMap.values());
  const duplicatesRemoved = totalAdsCount - finalLeads.length;

  return {
    leads: finalLeads,
    totalAdsCount,
    rejectedCount,
    uncertainCount,
    evaluatedCount,
    counters: {
      rawAds: totalAdsCount,
      normalizedCandidates: evaluatedCount,
      relevantCandidates: finalLeads.length,
      uncertainCandidates: uncertainCount,
      notRelevantCandidates: rejectedCount,
      duplicatesRemoved: Math.max(0, duplicatesRemoved),
      finalUniqueLeads: finalLeads.length,
      reasonCodes
    }
  };
}

/**
 * Sanitizes field to prevent formula injection in Excel/CSV
 * (=, +, -, @, \t, \r)
 */
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Protect against spreadsheet formula injection (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes per RFC 4180
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates RFC-compliant and formula-safe CSV from leads
 */
export function exportLeadsToCsv(
  leads: ExtensionLead[],
  runOrOptions?: ExtensionResearchRun | LeadExportOptions,
  options?: LeadExportOptions
): string {
  let run: ExtensionResearchRun | undefined;
  let opts: LeadExportOptions | undefined = options;

  if (runOrOptions && typeof runOrOptions === 'object' && ('qualifiedOnly' in runOrOptions || 'reviewOnly' in runOrOptions || 'rejectedOnly' in runOrOptions)) {
    opts = runOrOptions as LeadExportOptions;
  } else if (runOrOptions && typeof runOrOptions === 'object') {
    run = runOrOptions as ExtensionResearchRun;
  }

  let exportLeads = leads;
  if (opts?.qualifiedOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      return evaluateLeadQualificationGates(l, gateCriteria).isQualified;
    });
  } else if (opts?.reviewOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      const res = evaluateLeadQualificationGates(l, gateCriteria);
      return !res.isQualified && res.canonicalOutcome === 'REVIEW';
    });
  } else if (opts?.rejectedOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      const res = evaluateLeadQualificationGates(l, gateCriteria);
      return res.canonicalOutcome === 'REJECTED';
    });
  }

  let metaHeader = '';
  if (run) {
    const isAutoDiscovery = run.researchMode === 'AUTO_DISCOVERY' || run.targetLeadCount === undefined;
    const finalCount = run.leads ? run.leads.length : exportLeads.length;
    if (isAutoDiscovery) {
      metaHeader = `# Research Run: ${run.researchName} | Mode: Auto Discovery (${run.mode}) | Source: Meta Ad Library | Keywords: ${(run.keywords || []).join('; ')} | Location: ${run.locationName} | Final Relevant Leads: ${finalCount} | Status: ${run.status} | Stop Reason: ${run.stopReason || 'N/A'} | Engine Version: ${run.engineVersion || 'strict-v2'}\r\n`;
    } else {
      metaHeader = `# Research Run: ${run.researchName} | Mode: ${run.mode} | Requested Quota: ${run.targetLeadCount} | Final Relevant Leads: ${finalCount} | Status: ${run.status} | Stop Reason: ${run.stopReason || 'N/A'} | Engine Version: ${run.engineVersion || 'strict-v2'}\r\n`;
    }
  }

  const headers = [
    'Lead Name',
    'Facebook Page Name',
    'Facebook Page URL',
    'Facebook Page Status',
    'Website Domain',
    'Destination URL',
    'Website Status',
    'Active Ads Count',
    'Matched Keywords',
    'Location Code',
    'Location Name',
    'Target Country Code',
    'Business Country Code',
    'Geographic Classification',
    'Location Confidence',
    'Location Evidence',
    'Ad Library IDs',
    'Meta Ad Library URL',
    'Relevance Decision',
    'Relevance Score',
    'Relevance Confidence',
    'Relevance Matched Terms',
    'Relevance Explanation',
    'Engine Version',
    'Status',
    'Discovered At',
    'Sample Copy',
    'Sample CTA',
    'CTA Type',
    'Destination Type',
    'Destination Confidence',
    'Destination Reason',
    'Website Verified URL',
    'Website Deep Verification Status',
    'Website Identity Match',
    'Website Category Match',
    'Website Commercial Signals',
    'Website Evidence Summary',
    'Website Verified At',
    'Canonical Page ID',
    'Canonical Page Slug',
    'Identity Confidence',
    'Relationship Type',
    'Aliases',
    'Public Observed Phone',
    'Public Observed Email',
    'Phone Syntax Status',
    'Email Syntax Status',
    'Contact Evidence Source',
    'Contact Conflict Status',
    'Contact Quality State',
    'Contact Verification State',
    'Lead Priority Score',
    'Prioritization Tier',
    'Score Model Version',
    'Score Explanation'
  ];

  const rows = exportLeads.map(l => {
    const isCanonical = Boolean(l && typeof l === 'object' && ('canonicalEntityId' in l || 'canonicalBusinessName' in l));
    const can = l as any;
    const name = l.name || (isCanonical ? (can.canonicalBusinessName?.preferredObservedValue || can.canonicalBusinessName?.value || can.displayName) : '') || 'Unknown Advertiser';
    const fbName = l.facebookPageName || name;
    const fbUrl = l.facebookPageUrl || (isCanonical ? can.digital?.socialProfiles?.facebook : '') || '';
    const destDomain = l.destinationDomain || (isCanonical ? can.digital?.domains?.value?.[0] : '') || '';
    const destUrl = l.destinationUrl || (isCanonical ? (can.digital?.verifiedWebsite?.value || can.digital?.domains?.value?.[0]) : '') || '';
    const targetCountry = l.targetCountryCode || l.locationCode || (isCanonical ? can.business?.country?.value : '') || '';
    const busCountry = l.businessCountryCode || (isCanonical ? can.business?.country?.value : '') || '';

    let geo = l.geographicClassification;
    if (!geo) {
      if (busCountry && targetCountry && busCountry === targetCountry) {
        geo = 'LOCAL_PROBABLE'; // Do not promote unverified to LOCAL_VERIFIED without proof
      } else if (busCountry && targetCountry && busCountry !== targetCountry) {
        geo = 'FOREIGN_VERIFIED';
      } else {
        geo = 'LOCATION_UNKNOWN';
      }
    }

    const phone = l.businessPhone || (l.phones && l.phones[0]) || (isCanonical ? can.contacts?.phones?.[0]?.value : '') || '';
    const email = l.businessEmail || (l.emails && l.emails[0]) || (isCanonical ? can.contacts?.emails?.[0]?.value : '') || '';

    return [
      sanitizeCsvField(name),
      sanitizeCsvField(fbName),
      sanitizeCsvField(fbUrl),
      sanitizeCsvField(l.facebookPageState || (fbUrl ? 'found' : 'not_found')),
      sanitizeCsvField(destDomain),
      sanitizeCsvField(destUrl),
      sanitizeCsvField(l.websiteState || (destUrl ? 'found' : 'not_found')),
      sanitizeCsvField(l.activeAdCount || (isCanonical ? can.evidence?.evidencePack?.observationCount || 1 : 1)),
      sanitizeCsvField((l.matchedKeywords || []).join('; ')),
      sanitizeCsvField(l.locationCode || ''),
      sanitizeCsvField(l.locationName || ''),
      sanitizeCsvField(targetCountry),
      sanitizeCsvField(busCountry),
      sanitizeCsvField(geo),
      sanitizeCsvField(l.businessLocationConfidence || 'NONE'),
      sanitizeCsvField((l.businessLocationEvidence || []).join(' | ')),
      sanitizeCsvField((l.adLibraryIds || []).join('; ')),
      sanitizeCsvField(l.adLibraryUrl || ''),
      sanitizeCsvField(l.relevanceDecision || 'UNASSESSED'),
      sanitizeCsvField(l.relevanceScore !== undefined ? `${(l.relevanceScore * 100).toFixed(0)}%` : (l.relevanceDecision === 'RELEVANT' ? '100%' : 'N/A')),
      sanitizeCsvField(l.relevanceConfidence || (l.relevanceDecision ? 'HIGH' : 'NONE')),
      sanitizeCsvField(l.relevanceMatchedTerms ? l.relevanceMatchedTerms.join('; ') : ''),
      sanitizeCsvField(l.relevanceReasons ? l.relevanceReasons.slice(0, 2).join(' | ') : ''),
      sanitizeCsvField(l.engineVersion || 'strict-v2'),
      sanitizeCsvField(l.status || (isCanonical ? can.qualification?.finalState || 'QUALIFIED' : 'REVIEW_REQUIRED')),
      sanitizeCsvField(l.discoveredAt || new Date().toISOString()),
      sanitizeCsvField(l.sampleCopy || ''),
      sanitizeCsvField(l.sampleCta || ''),
      sanitizeCsvField(l.primaryCtaType || 'UNKNOWN'),
      sanitizeCsvField(l.primaryDestinationType || 'UNKNOWN'),
      sanitizeCsvField(l.destinationConfidence || 'NONE'),
      sanitizeCsvField(l.destinationReasonCode || 'DESTINATION_NOT_OBSERVED'),
      sanitizeCsvField(l.websiteVerification?.finalUrl || destUrl),
      sanitizeCsvField(l.websiteVerificationStatus || (l.websiteVerification?.status) || (destUrl ? 'NOT_VERIFIED' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.websiteVerification?.identityMatch || 'UNKNOWN'),
      sanitizeCsvField(l.websiteVerification?.categoryMatch || 'UNKNOWN'),
      sanitizeCsvField((l.websiteVerification?.commercialSignals || []).join('; ')),
      sanitizeCsvField((l.websiteVerification?.evidence || []).map(e => e.reason).slice(0, 3).join(' | ')),
      sanitizeCsvField(l.websiteVerification?.verifiedAt || ''),
      sanitizeCsvField(l.canonicalPageId || ''),
      sanitizeCsvField(l.canonicalPageSlug || ''),
      sanitizeCsvField(l.identityConfidence || 'UNRESOLVED'),
      sanitizeCsvField(l.relationshipType || 'INDEPENDENT_BUSINESS'),
      sanitizeCsvField((l.aliases || []).join('; ')),
      sanitizeCsvField(phone),
      sanitizeCsvField(email),
      sanitizeCsvField(l.contactProfile?.observedPhones?.[0]?.syntaxState || (phone ? 'SYNTAX_VALID' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.contactProfile?.observedEmails?.[0]?.syntaxState || (email ? 'SYNTAX_VALID' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.contactProfile?.observedPhones?.[0]?.sourceSurface || l.contactProfile?.observedEmails?.[0]?.sourceSurface || (phone || email ? 'AD_BODY_TEXT' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.contactProfile?.phoneConflictState || l.contactProfile?.emailConflictState || 'NOT_APPLICABLE'),
      sanitizeCsvField(l.contactQualityState || l.contactProfile?.overallQualityState || (phone || email ? 'OBSERVED_VALID_SYNTAX' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.contactProfile?.observedPhones?.[0]?.verificationStatus || l.contactProfile?.observedEmails?.[0]?.verificationStatus || (phone || email ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED')),
      sanitizeCsvField(l.leadScore !== undefined ? l.leadScore : 'N/A'),
      sanitizeCsvField(l.prioritizationTier || 'UNRANKED'),
      sanitizeCsvField(l.scoreModelVersion || 'leadnoria-scoring-v1'),
      sanitizeCsvField(l.scoreExplanation || '')
    ];
  });

  return metaHeader + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

/**
 * Generates deterministic, valid JSON containing complete structured lead records,
 * supporting qualified-only, review-only, and rejected-only filters, full evidence,
 * and formula injection immunity.
 */
export function exportLeadsToJson(
  leads: ExtensionLead[],
  runOrOptions?: ExtensionResearchRun | LeadExportOptions,
  options?: LeadExportOptions
): string {
  let run: ExtensionResearchRun | undefined;
  let opts: LeadExportOptions | undefined = options;

  if (runOrOptions && typeof runOrOptions === 'object' && ('qualifiedOnly' in runOrOptions || 'reviewOnly' in runOrOptions || 'rejectedOnly' in runOrOptions || 'pretty' in runOrOptions)) {
    opts = runOrOptions as LeadExportOptions;
  } else if (runOrOptions && typeof runOrOptions === 'object' && ('runId' in runOrOptions || 'keywords' in runOrOptions)) {
    run = runOrOptions as ExtensionResearchRun;
  }

  let exportLeads = leads;
  if (opts?.qualifiedOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      return evaluateLeadQualificationGates(l, gateCriteria).isQualified;
    });
  } else if (opts?.reviewOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      const res = evaluateLeadQualificationGates(l, gateCriteria);
      return !res.isQualified && res.canonicalOutcome === 'REVIEW';
    });
  } else if (opts?.rejectedOnly) {
    exportLeads = leads.filter(l => {
      const gateCriteria = (run && 'researchIntent' in run && (run as any).researchIntent) ? (run as any).researchIntent : opts;
      const res = evaluateLeadQualificationGates(l, gateCriteria);
      return res.canonicalOutcome === 'REJECTED';
    });
  }

  const exportPayload = {
    product: 'LeadNoria',
    source: 'Meta Ad Library',
    version: run?.engineVersion || '1.7.7',
    exportedAt: new Date().toISOString(),
    ...(run ? {
      runId: run.runId,
      researchName: run.researchName,
      mode: run.mode,
      locationName: run.locationName,
      targetCountryCode: (run as any).researchIntent?.targetCountryCode || run.countryCode
    } : {}),
    totalLeads: exportLeads.length,
    leads: exportLeads
  };

  const pretty = opts?.pretty !== false;
  return pretty ? JSON.stringify(exportPayload, null, 2) : JSON.stringify(exportPayload);
}
