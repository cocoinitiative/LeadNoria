/**
 * LeadNoria — Call-to-Action (CTA) & Destination Classification Engine (Phase 0.4)
 *
 * Implements deterministic separation between:
 * - CTA text & type: The action wording presented to the user (e.g. 'Shop Now', 'Call Now').
 * - Destination type: The actual technical endpoint of the advertisement:
 *     - EXTERNAL_WEBSITE (independent commercial website)
 *     - INSTANT_FORM (Meta on-platform lead generation form)
 *     - MESSAGING (WhatsApp, Messenger direct chat flow)
 *     - CALL (direct telephone call endpoint)
 *     - APP (Google Play or Apple App Store download)
 *     - OTHER (internal page link, event, etc.)
 *     - UNKNOWN (unverified or missing endpoint)
 *     - NO_VISIBLE_DESTINATION (explicit observation of no clickable destination)
 *
 * Adheres to strict constraints:
 * - Pure deterministic local evaluation (zero external requests, zero URL fetching/redirects).
 * - Missing destination URL does NOT prove that no website exists.
 * - SHOP_NOW or LEARN_MORE alone does NOT prove EXTERNAL_WEBSITE without corroborating URL.
 */

import type { CtaType, DestinationType, AdLevelEvidence } from './types.ts';

export interface CtaClassificationResult {
  ctaType: CtaType;
  rawCtaText?: string;
  originalCtaText?: string;
  normalizedText: string;
  status: 'CLASSIFIED' | 'UNSUPPORTED' | 'MISSING' | 'AMBIGUOUS';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  evidence: string;
  reasonCode: string;
  reason: string;
}

export interface DestinationClassifierInputs {
  destinationUrl?: string;
  destinationDomain?: string;
  ctaText?: string;
  ctaType?: CtaType;
  bodyCopy?: string;
  rawText?: string;
  hasNoDestination?: boolean;
  hasNoDestinationSignal?: boolean;
  hasLeadFormSignal?: boolean;
}

export interface DestinationClassificationResult {
  destinationType: DestinationType;
  destinationDomain?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasonCode: string;
  reason: string;
}

export interface AggregatedDestinationSummary {
  observedCtaTexts: string[];
  observedCtaTypes: CtaType[];
  observedDestinationTypes: DestinationType[];
  primaryCtaType: CtaType;
  primaryDestinationType: DestinationType;
  destinationConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  destinationReasonCode: string;
}

/**
 * Classifies visible Call-to-Action (CTA) text into normalized CtaType.
 */
export function classifyCta(rawCtaText?: string): CtaClassificationResult {
  if (!rawCtaText) {
    return {
      ctaType: 'UNKNOWN',
      rawCtaText: undefined,
      originalCtaText: undefined,
      normalizedText: '',
      status: 'MISSING',
      confidence: 'NONE',
      evidence: 'No visible call-to-action button or text observed.',
      reasonCode: 'CTA_TEXT_MISSING',
      reason: 'No visible call-to-action button or text observed.'
    };
  }

  const rawPreserved = rawCtaText.trim();
  const normalizedText = rawPreserved.replace(/\s+/g, ' ');
  if (!normalizedText) {
    return {
      ctaType: 'UNKNOWN',
      rawCtaText: undefined,
      originalCtaText: undefined,
      normalizedText: '',
      status: 'MISSING',
      confidence: 'NONE',
      evidence: 'Call-to-action text is whitespace-only.',
      reasonCode: 'CTA_TEXT_MISSING',
      reason: 'Call-to-action text is whitespace-only.'
    };
  }

  // Strip leading and trailing punctuation for robust matching while preserving normalizedText
  const clean = normalizedText.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '').toLowerCase();

  // Check for ambiguous CTA text (contradictory action intents in a single string)
  const hasCall = /\b(?:call|phone)\b/i.test(clean);
  const hasDownload = /\b(?:download|install|app)\b/i.test(clean);
  const hasShop = /\b(?:shop|buy|order)\b/i.test(clean);
  const hasMsg = /\b(?:message|whatsapp|chat)\b/i.test(clean);
  const intentCount = [hasCall, hasDownload, hasShop, hasMsg].filter(Boolean).length;
  if (intentCount >= 2) {
    return {
      ctaType: 'OTHER',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'AMBIGUOUS',
      confidence: 'LOW',
      evidence: `Ambiguous CTA text containing multiple conflicting action intents: "${normalizedText}".`,
      reasonCode: 'CTA_TEXT_AMBIGUOUS',
      reason: `Call-to-action text combines multiple distinct intents ("${normalizedText}").`
    };
  }

  // 1. SHOP_NOW
  if (/^(?:shop(?:\s*now|\s*collection)?|buy(?:\s*now)?|order(?:\s*now)?)$/i.test(clean)) {
    return {
      ctaType: 'SHOP_NOW',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: SHOP_NOW.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: SHOP_NOW.'
    };
  }

  // 2. LEARN_MORE
  if (/^(?:learn(?:\s*more)?|explore(?:\s*more)?|see(?:\s*more)?|read(?:\s*more)?|view(?:\s*more)?)$/i.test(clean)) {
    return {
      ctaType: 'LEARN_MORE',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: LEARN_MORE.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: LEARN_MORE.'
    };
  }

  // 3. SIGN_UP
  if (/^(?:sign(?:\s*up)?|register(?:\s*now)?|subscribe|join(?:\s*now|\s*us)?)$/i.test(clean)) {
    return {
      ctaType: 'SIGN_UP',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: SIGN_UP.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: SIGN_UP.'
    };
  }

  // 4. CONTACT_US
  if (/^(?:contact(?:\s*us)?|inquire(?:\s*now)?|get(?:\s*in\s*touch)?|send(?:\s*inquiry)?)$/i.test(clean)) {
    return {
      ctaType: 'CONTACT_US',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: CONTACT_US.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: CONTACT_US.'
    };
  }

  // 5. SEND_MESSAGE
  if (/^(?:send(?:\s*message|\s*whatsapp(?:\s*message)?)?|message(?:\s*us)?|chat(?:\s*now)?|whatsapp)$/i.test(clean)) {
    return {
      ctaType: 'SEND_MESSAGE',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: SEND_MESSAGE.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: SEND_MESSAGE.'
    };
  }

  // 6. CALL_NOW
  if (/^(?:call(?:\s*now|\s*us)?|phone(?:\s*us)?)$/i.test(clean)) {
    return {
      ctaType: 'CALL_NOW',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: CALL_NOW.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: CALL_NOW.'
    };
  }

  // 7. DOWNLOAD
  if (/^(?:download(?:\s*now)?|install(?:\s*now)?|get(?:\s*app)?)$/i.test(clean)) {
    return {
      ctaType: 'DOWNLOAD',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: DOWNLOAD.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: DOWNLOAD.'
    };
  }

  // 8. GET_QUOTE
  if (/^(?:get(?:\s*quote|\s*offer)?|request(?:\s*quote)?|apply(?:\s*now)?)$/i.test(clean)) {
    return {
      ctaType: 'GET_QUOTE',
      rawCtaText: rawPreserved,
      originalCtaText: rawPreserved,
      normalizedText,
      status: 'CLASSIFIED',
      confidence: 'HIGH',
      evidence: 'Recognized call-to-action intent: GET_QUOTE.',
      reasonCode: 'CTA_TEXT_MATCH',
      reason: 'Recognized call-to-action intent: GET_QUOTE.'
    };
  }

  // 9. OTHER (Visible text that does not map to common categories)
  return {
    ctaType: 'OTHER',
    rawCtaText: rawPreserved,
    originalCtaText: rawPreserved,
    normalizedText,
    status: 'UNSUPPORTED',
    confidence: 'LOW',
    evidence: `Observed visible CTA text: "${normalizedText}".`,
    reasonCode: 'CTA_TEXT_OTHER',
    reason: `Observed visible CTA text: "${normalizedText}".`
  };
}

/**
 * Classifies technical DestinationType from permitted ad data.
 */
export function classifyDestination(inputs: DestinationClassifierInputs): DestinationClassificationResult {
  const rawUrl = (inputs.destinationUrl || '').trim();
  const hasNoDest = Boolean(inputs.hasNoDestination || inputs.hasNoDestinationSignal);

  // Conflicting signals: ad claims no visible destination, yet destination URL is present
  if (hasNoDest && rawUrl) {
    return {
      destinationType: 'UNKNOWN',
      confidence: 'LOW',
      reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
      reason: 'Ad marked with no destination signal but destination URL is present.'
    };
  }

  // 1. Explicitly observed absence of destination
  if (hasNoDest) {
    return {
      destinationType: 'NO_VISIBLE_DESTINATION',
      confidence: 'HIGH',
      reasonCode: 'DESTINATION_NOT_OBSERVED',
      reason: 'Explicit observation that ad creative contains no clickable destination or action button.'
    };
  }

  // 1.5. Explicit lead form signal flag
  if (inputs.hasLeadFormSignal && !rawUrl) {
    return {
      destinationType: 'INSTANT_FORM',
      confidence: 'HIGH',
      reasonCode: 'EXPLICIT_INSTANT_FORM_SIGNAL',
      reason: 'Meta on-platform instant lead generation form signal detected.'
    };
  }

  const targetCtaType = inputs.ctaType || (inputs.ctaText ? classifyCta(inputs.ctaText).ctaType : 'UNKNOWN');

  // If destinationUrl is present, evaluate technical endpoint
  if (rawUrl) {
    const lowerUrl = rawUrl.toLowerCase();

    // Protocol check: Scripting or data pseudo-protocols are invalid destinations
    if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('about:')) {
      return {
        destinationType: 'UNKNOWN',
        confidence: 'NONE',
        reasonCode: 'MALFORMED_DESTINATION_URL',
        reason: `Unsupported or invalid script/data URL scheme: "${rawUrl}".`
      };
    }

    // Protocol check: Direct telephone call protocols
    if (lowerUrl.startsWith('tel:') || lowerUrl.startsWith('callto:')) {
      if (targetCtaType === 'DOWNLOAD') {
        return {
          destinationType: 'OTHER',
          confidence: 'LOW',
          reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
          reason: 'Conflicting destination signals detected between telephone URI and download CTA.'
        };
      }
      return {
        destinationType: 'CALL',
        destinationDomain: undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_CALL_SIGNAL',
        reason: `Direct telephone call URI observed: "${rawUrl}".`
      };
    }

    // Protocol check: Direct messaging protocols
    if (
      lowerUrl.startsWith('sms:') ||
      lowerUrl.startsWith('whatsapp:') ||
      lowerUrl.startsWith('fb-messenger:') ||
      lowerUrl.startsWith('tg:')
    ) {
      if (targetCtaType === 'CALL_NOW') {
        return {
          destinationType: 'OTHER',
          confidence: 'LOW',
          reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
          reason: 'Conflicting destination signals detected between messaging URI and call CTA.'
        };
      }
      return {
        destinationType: 'MESSAGING',
        destinationDomain: undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_MESSAGING_SIGNAL',
        reason: `Direct messaging URI protocol observed: "${rawUrl}".`
      };
    }

    // Protocol check: Native App Store marketplace protocols
    if (lowerUrl.startsWith('market:') || lowerUrl.startsWith('itms-apps:')) {
      if (targetCtaType === 'CALL_NOW' || targetCtaType === 'SEND_MESSAGE') {
        return {
          destinationType: 'OTHER',
          confidence: 'LOW',
          reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
          reason: 'Conflicting destination signals detected between native app marketplace URI and CTA intent.'
        };
      }
      return {
        destinationType: 'APP',
        destinationDomain: undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_APP_SIGNAL',
        reason: `Native application marketplace protocol URI observed: "${rawUrl}".`
      };
    }

    // Protocol check: Email destination protocol (mailto:)
    if (lowerUrl.startsWith('mailto:')) {
      return {
        destinationType: 'OTHER',
        destinationDomain: undefined,
        confidence: 'MEDIUM',
        reasonCode: 'EMAIL_DESTINATION_SIGNAL',
        reason: `Direct email destination URI observed: "${rawUrl}".`
      };
    }

    // Decode Facebook shim if needed (facebook.com/l.php?u=...)
    let resolvedUrl = lowerUrl;
    if (lowerUrl.includes('facebook.com/l.php')) {
      try {
        const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        const shimmed = u.searchParams.get('u');
        if (shimmed) {
          resolvedUrl = decodeURIComponent(shimmed).toLowerCase();
        }
      } catch {}
    }

    let domain = (inputs.destinationDomain || '').toLowerCase().trim();
    if (!domain) {
      try {
        const u = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `https://${resolvedUrl}`);
        const host = u.hostname.toLowerCase();
        domain = host === 'm.me' ? 'm.me' : host.replace(/^(?:www\.|m\.|l\.)/, '');
      } catch {
        return {
          destinationType: 'UNKNOWN',
          confidence: 'NONE',
          reasonCode: 'MALFORMED_DESTINATION_URL',
          reason: `Provided destination URL is malformed or invalid: "${rawUrl}".`
        };
      }
    }

    if (
      !domain ||
      !domain.includes('.') ||
      domain.length < 4 ||
      domain.endsWith('.') ||
      domain.startsWith('.') ||
      !/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/i.test(domain)
    ) {
      return {
        destinationType: 'UNKNOWN',
        confidence: 'NONE',
        reasonCode: 'MALFORMED_DESTINATION_URL',
        reason: `Provided destination URL does not contain a valid domain hostname: "${rawUrl}".`
      };
    }

    // Check for conflicting signals between URL and CTA
    const isAppUrl = /^(?:play\.google\.com|apps\.apple\.com|itunes\.apple\.com)$/i.test(domain);
    if (isAppUrl && (targetCtaType === 'CALL_NOW' || targetCtaType === 'SEND_MESSAGE')) {
      return {
        destinationType: 'OTHER',
        confidence: 'LOW',
        reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
        reason: 'Conflicting destination signals detected between action URL (App) and CTA intent.'
      };
    }

    // Messaging web endpoints
    if (
      domain === 'wa.me' ||
      domain === 'api.whatsapp.com' ||
      domain === 'whatsapp.com' ||
      domain === 'm.me' ||
      domain === 'messenger.com' ||
      domain === 't.me' ||
      domain === 'telegram.me' ||
      resolvedUrl.includes('facebook.com/messages')
    ) {
      if (targetCtaType === 'CALL_NOW') {
        return {
          destinationType: 'OTHER',
          confidence: 'LOW',
          reasonCode: 'CONFLICTING_DESTINATION_SIGNALS',
          reason: 'Conflicting destination signals detected between messaging URL and call CTA.'
        };
      }
      return {
        destinationType: 'MESSAGING',
        destinationDomain: domain || undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_MESSAGING_SIGNAL',
        reason: 'Verified messaging destination via WhatsApp or Messenger endpoint.'
      };
    }

    // App store web endpoints
    if (
      (domain === 'play.google.com' && resolvedUrl.includes('/store/apps')) ||
      domain === 'apps.apple.com' ||
      domain === 'itunes.apple.com'
    ) {
      return {
        destinationType: 'APP',
        destinationDomain: domain || undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_APP_SIGNAL',
        reason: 'Verified native application marketplace destination.'
      };
    }

    // Instant Form / Lead Gen flow
    if (
      resolvedUrl.includes('/lead_gen/') ||
      resolvedUrl.includes('fb.com/lead_gen') ||
      resolvedUrl.includes('/canvas_doc/') ||
      resolvedUrl.includes('instant_form')
    ) {
      return {
        destinationType: 'INSTANT_FORM',
        destinationDomain: domain || undefined,
        confidence: 'HIGH',
        reasonCode: 'EXPLICIT_INSTANT_FORM_SIGNAL',
        reason: 'Verified Meta on-platform instant lead generation form.'
      };
    }

    // External Website flow
    const isInternalSocialDomain =
      domain === 'facebook.com' ||
      domain === 'web.facebook.com' ||
      domain === 'm.facebook.com' ||
      domain === 'fb.com' ||
      domain === 'instagram.com' ||
      domain === 'meta.com';

    if (!isInternalSocialDomain && domain.length > 3 && domain.includes('.')) {
      return {
        destinationType: 'EXTERNAL_WEBSITE',
        destinationDomain: domain,
        confidence: 'HIGH',
        reasonCode: 'VISIBLE_EXTERNAL_DESTINATION',
        reason: `Positively identified external commercial website: "${domain}".`
      };
    }

    // Internal social page
    if (isInternalSocialDomain) {
      return {
        destinationType: 'OTHER',
        destinationDomain: domain || undefined,
        confidence: 'MEDIUM',
        reasonCode: 'INTERNAL_PAGE_DESTINATION',
        reason: 'Destination directs to internal social page rather than external commercial website.'
      };
    }
  }

  // Destination URL is NOT present: examine CTA and contextual signals
  if (targetCtaType === 'CALL_NOW') {
    return {
      destinationType: 'CALL',
      confidence: 'MEDIUM',
      reasonCode: 'EXPLICIT_CALL_SIGNAL',
      reason: 'Direct telephone call action observed from call CTA.'
    };
  }

  if (targetCtaType === 'SEND_MESSAGE') {
    return {
      destinationType: 'MESSAGING',
      confidence: 'MEDIUM',
      reasonCode: 'EXPLICIT_MESSAGING_SIGNAL',
      reason: 'Direct messaging flow indicated by messaging CTA without external URL.'
    };
  }

  // Explicit instant form indicators in text
  const combinedContext = [inputs.bodyCopy || '', inputs.rawText || ''].join(' ').toLowerCase();
  if (combinedContext.includes('[instant form]') || combinedContext.includes('lead form')) {
    return {
      destinationType: 'INSTANT_FORM',
      confidence: 'MEDIUM',
      reasonCode: 'EXPLICIT_INSTANT_FORM_SIGNAL',
      reason: 'Instant form destination indicated by ad metadata.'
    };
  }

  // Critical rule: Action buttons without URL do NOT prove a destination
  if (
    targetCtaType === 'SHOP_NOW' ||
    targetCtaType === 'LEARN_MORE' ||
    targetCtaType === 'SIGN_UP' ||
    targetCtaType === 'GET_QUOTE' ||
    targetCtaType === 'DOWNLOAD' ||
    targetCtaType === 'CONTACT_US'
  ) {
    return {
      destinationType: 'UNKNOWN',
      confidence: 'LOW',
      reasonCode: 'INSUFFICIENT_DESTINATION_EVIDENCE',
      reason: 'Action button observed but destination URL was not extracted; destination type remains unverified.'
    };
  }

  // Fallback: destination is unobserved / unknown
  return {
    destinationType: 'UNKNOWN',
    confidence: 'NONE',
    reasonCode: 'DESTINATION_NOT_OBSERVED',
    reason: 'No destination URL or destination metadata observed for this ad candidate.'
  };
}

const DESTINATION_PRECEDENCE: Record<DestinationType, number> = {
  EXTERNAL_WEBSITE: 7,
  INSTANT_FORM: 6,
  MESSAGING: 5,
  CALL: 4,
  APP: 3,
  OTHER: 2,
  NO_VISIBLE_DESTINATION: 1,
  UNKNOWN: 0
};

/**
 * Aggregates ad-level evidence into deterministic advertiser-level summaries.
 */
export function aggregateAdEvidence(adEvidenceList: AdLevelEvidence[]): AggregatedDestinationSummary {
  if (!adEvidenceList || adEvidenceList.length === 0) {
    return {
      observedCtaTexts: [],
      observedCtaTypes: [],
      observedDestinationTypes: [],
      primaryCtaType: 'UNKNOWN',
      primaryDestinationType: 'UNKNOWN',
      destinationConfidence: 'NONE',
      destinationReasonCode: 'DESTINATION_NOT_OBSERVED'
    };
  }

  const ctaTexts = Array.from(new Set(adEvidenceList.map(e => e.ctaText).filter(Boolean) as string[]));
  const ctaTypes = Array.from(new Set(adEvidenceList.map(e => e.ctaType).filter(t => t !== 'UNKNOWN')));
  const destinationTypes = Array.from(new Set(adEvidenceList.map(e => e.destinationType)));

  // Determine primary CTA (most frequent, or first non-unknown)
  const ctaCounts = new Map<CtaType, number>();
  for (const e of adEvidenceList) {
    if (e.ctaType && e.ctaType !== 'UNKNOWN') {
      ctaCounts.set(e.ctaType, (ctaCounts.get(e.ctaType) || 0) + 1);
    }
  }

  let primaryCta: CtaType = 'UNKNOWN';
  let maxCtaCount = 0;
  for (const [type, count] of ctaCounts.entries()) {
    if (count > maxCtaCount) {
      maxCtaCount = count;
      primaryCta = type;
    }
  }
  if (primaryCta === 'UNKNOWN' && adEvidenceList.length > 0) {
    primaryCta = adEvidenceList[0].ctaType;
  }

  // Determine primary Destination (highest precedence)
  let primaryDest: DestinationType = 'UNKNOWN';
  let maxPrec = -1;
  let bestEvidence: AdLevelEvidence = adEvidenceList[0];

  for (const e of adEvidenceList) {
    const prec = DESTINATION_PRECEDENCE[e.destinationType] ?? 0;
    if (prec > maxPrec) {
      maxPrec = prec;
      primaryDest = e.destinationType;
      bestEvidence = e;
    }
  }

  return {
    observedCtaTexts: ctaTexts,
    observedCtaTypes: ctaTypes.length > 0 ? ctaTypes : ['UNKNOWN'],
    observedDestinationTypes: destinationTypes.length > 0 ? destinationTypes : ['UNKNOWN'],
    primaryCtaType: primaryCta,
    primaryDestinationType: primaryDest,
    destinationConfidence: bestEvidence.confidence,
    destinationReasonCode: bestEvidence.reasonCode
  };
}
