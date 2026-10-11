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
  AdExtractionResult
} from './types.ts';
import { LeadRelevanceEngine } from './relevanceEngine.ts';
import type { ResearchIntent } from './relevanceEngine.ts';

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

  const text = doc.body ? doc.body.innerText : '';

  if (text.includes('Security Check') || text.includes('Enter the characters you see below')) {
    return { isBlocked: true, reason: 'Meta Security Check / CAPTCHA challenge presented.', code: 'CHALLENGED' };
  }

  if (text.includes('You’re Temporarily Blocked') || text.includes('You are temporarily blocked') || text.includes('Rate limit exceeded') || text.includes('Too Many Requests')) {
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
    .replace(/[\u00A0\u200B\u202F\uFEFF]/g, ' ')
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
    { regex: /(?:ID\s+da\s+biblioteca)\s*:\s*([0-9]{5,25})/i, label: 'ID da biblioteca' }
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
    rawText: cardFullText.substring(0, 200)
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
        if (!idCandidates.some(c => c.idInfo.id === id)) {
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
      if (!/(?:ID|Identifiant|Bibliothek)/i.test(text)) continue;

      // CRITICAL: Strictly isolate innermost leaf elements.
      // If ANY descendant element also contains the identifier, the child is the specific
      // leaf container, and evaluating this ancestor element will concatenate adjacent sibling
      // text nodes (such as dates '18 Nov' or version counts), producing corrupted/concatenated IDs.
      const hasMatchingChild = (node: HTMLElement): boolean => {
        if (!node.children || node.children.length === 0) return false;
        for (const child of Array.from(node.children)) {
          const childText = child.textContent || '';
          if (/(?:ID|Identifiant|Bibliothek)/i.test(childText) &&
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
        if (!idCandidates.some(c => c.idInfo.id === idInfo.id)) {
          idCandidates.push({ idEl: htmlEl, idInfo });
        }
      }
    }

    identifierCandidatesFound = idCandidates.length;

    // 3. Process each identifier candidate with physical card root deduplication
    const seenCardRoots = new Set<HTMLElement>();

    for (const { idEl, idInfo } of idCandidates) {
      cardsExamined++;
      const { id: libraryId } = idInfo;

      if (idInfo.isAmbiguous) {
        cardsRejectedMissingId++;
        diagnosticDetails.push({
          libraryId,
          outcome: 'AMBIGUOUS_CANDIDATE',
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
      const candidate = extractFieldsFromCard(containerResult.cardRoot, libraryId, observedKeyword);
      candidates.push(candidate);
      seenLibraryIds.add(candidate.libraryId);
      diagnosticDetails.push({ libraryId: candidate.libraryId, outcome: 'VALID_CANDIDATE' });
    }

    const duration = Date.now() - startTime;
    const status: ExtractionResultStatus = candidates.length > 0 ? 'RESULTS_FOUND' : 'NO_NEW_RESULTS_OBSERVED';

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
      candidates: [],
      diagnostics: {
        cardsExamined,
        identifierCandidatesFound,
        validCardsAccepted: 0,
        cardsRejectedMissingId,
        duplicateCardsIgnored,
        extractionDurationMs: Date.now() - startTime,
        scrollIteration: options?.scrollIteration,
        relevantMutationsObserved: options?.relevantMutationsObserved,
        details: [{ outcome: 'INVALID_CONTAINER', reason: err?.message || 'Extraction exception' }]
      },
      status: 'EXTRACTION_ERROR'
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
  locationCode: string,
  locationName: string,
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
  const effectiveCeiling = typeof maxResults === 'number' && maxResults > 0
    ? Math.min(maxResults, MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH)
    : MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH;

  // Group all candidates by normalized advertiser name
  const candidateGroups = new Map<string, ScrapedAdCandidate[]>();
  let totalAdsCount = 0;
  const reasonCodes: Record<string, number> = {};

  for (const cand of candidates) {
    totalAdsCount++;
    const cleanName = (cand.pageName || 'Unknown Advertiser').trim();
    if (!cleanName || cleanName === 'Unknown Advertiser') continue;

    const key = cleanName.toLowerCase();
    const group = candidateGroups.get(key) || [];
    group.push(cand);
    candidateGroups.set(key, group);
  }

  const actualExistingLeads = Array.isArray(existingLeads) ? existingLeads : [];
  const actualIntent = intent || (!Array.isArray(existingLeads) && typeof existingLeads === 'object' ? existingLeads as unknown as ResearchIntent : undefined);

  const leadMap = new Map<string, ExtensionLead>();

  // Initialize with existing leads
  for (const lead of actualExistingLeads) {
    leadMap.set(lead.canonicalName.toLowerCase(), { ...lead });
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

    // 2. Candidate is RELEVANT (or no intent was provided for raw aggregation)
    const existing = leadMap.get(key);

    if (existing) {
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
      const webState = bestDestUrl ? 'found' : 'not_found';

      const lead: ExtensionLead = {
        id: `lead_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        canonicalName: cleanName,
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
        locationCode,
        locationName,
        status: webState === 'found' ? 'QUALIFIED' : 'REVIEW_REQUIRED',
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
  if (val === null || val === undefined) return '';
  let str = String(val).trim();

  // Neutralize tabs and carriage returns
  str = str.replace(/\t/g, ' ').replace(/\r/g, '');

  // Protect against spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates RFC-compliant and formula-safe CSV from leads
 */
export function exportLeadsToCsv(leads: ExtensionLead[], run?: ExtensionResearchRun): string {
  let metaHeader = '';
  if (run) {
    const isAutoDiscovery = run.researchMode === 'AUTO_DISCOVERY' || run.targetLeadCount === undefined;
    const finalCount = run.leads ? run.leads.length : leads.length;
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
    'Website Verified URL',
    'Website Deep Verification Status',
    'Website Identity Match',
    'Website Category Match',
    'Website Commercial Signals',
    'Website Evidence Summary',
    'Website Verified At'
  ];

  const rows = leads.map(l => [
    sanitizeCsvField(l.name),
    sanitizeCsvField(l.facebookPageName),
    sanitizeCsvField(l.facebookPageUrl || ''),
    sanitizeCsvField(l.facebookPageState),
    sanitizeCsvField(l.destinationDomain || ''),
    sanitizeCsvField(l.destinationUrl || ''),
    sanitizeCsvField(l.websiteState),
    sanitizeCsvField(l.activeAdCount),
    sanitizeCsvField((l.matchedKeywords || []).join('; ')),
    sanitizeCsvField(l.locationCode || ''),
    sanitizeCsvField(l.locationName || ''),
    sanitizeCsvField((l.adLibraryIds || []).join('; ')),
    sanitizeCsvField(l.adLibraryUrl || ''),
    sanitizeCsvField(l.relevanceDecision || 'RELEVANT'),
    sanitizeCsvField(l.relevanceScore !== undefined ? `${(l.relevanceScore * 100).toFixed(0)}%` : '100%'),
    sanitizeCsvField(l.relevanceConfidence || 'HIGH'),
    sanitizeCsvField(l.relevanceMatchedTerms ? l.relevanceMatchedTerms.join('; ') : ''),
    sanitizeCsvField(l.relevanceReasons ? l.relevanceReasons.slice(0, 2).join(' | ') : ''),
    sanitizeCsvField(l.engineVersion || 'strict-v2'),
    sanitizeCsvField(l.status),
    sanitizeCsvField(l.discoveredAt),
    sanitizeCsvField(l.sampleCopy || ''),
    sanitizeCsvField(l.sampleCta || ''),
    sanitizeCsvField(l.websiteVerification?.finalUrl || l.destinationUrl || ''),
    sanitizeCsvField(l.websiteVerificationStatus || (l.websiteVerification?.status) || (l.destinationUrl ? 'NOT_VERIFIED' : 'NO_WEBSITE')),
    sanitizeCsvField(l.websiteVerification?.identityMatch || 'UNKNOWN'),
    sanitizeCsvField(l.websiteVerification?.categoryMatch || 'UNKNOWN'),
    sanitizeCsvField((l.websiteVerification?.commercialSignals || []).join('; ')),
    sanitizeCsvField((l.websiteVerification?.evidence || []).map(e => e.reason).slice(0, 3).join(' | ')),
    sanitizeCsvField(l.websiteVerification?.verifiedAt || '')
  ]);

  return metaHeader + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}
