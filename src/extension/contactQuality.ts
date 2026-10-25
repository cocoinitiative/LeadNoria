/**
 * LeadNoria Phase 7: Contact Data Quality & Evidence Management
 *
 * Implements deterministic validation, normalization, provenance tracking,
 * and conflict detection for publicly visible business contact data available
 * through the authorized Meta Ad Library browser workflow.
 *
 * NON-NEGOTIABLE SAFETY CONSTRAINTS:
 * 1. Meta Ad Library-only.
 * 2. Strictly NO external network requests, crawling, SMTP checks, or phone pings.
 * 3. Technical accessibility does NOT imply verified reachability.
 * 4. Syntactically valid contacts are categorized as UNPROBED_PUBLIC_CLAIM.
 * 5. Unobserved contacts remain explicitly NOT_OBSERVED (never inferred).
 */

import {
  normalizePhone as baseNormalizePhone,
  normalizeEmail as baseNormalizeEmail,
  sanitizeText
} from './extraction/normalizer.ts';

// Banned placeholder/vendor email domains that do not represent genuine public business contacts
export const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'domain.com',
  'email.com',
  'sentry.io',
  'wixpress.com',
  'wordpress.org',
  'shopify.com',
  'myshopify.com',
  'gravatar.com',
  'schema.org',
  'facebook.com',
  'fb.com',
  'meta.com',
  'instagram.com'
]);

export type ContactFieldType = 'PHONE' | 'EMAIL' | 'WEBSITE' | 'SOCIAL_PROFILE';

export type ContactSourceSurface =
  | 'FACEBOOK_PAGE_ABOUT'
  | 'AD_BODY_TEXT'
  | 'TEL_LINK'
  | 'MAILTO_LINK'
  | 'WHATSAPP_LINK'
  | 'CALL_CTA'
  | 'DESTINATION_URL';

export type ContactSyntaxState =
  | 'SYNTAX_VALID'
  | 'SYNTAX_INVALID'
  | 'AMBIGUOUS'
  | 'NOT_OBSERVED';

export type ContactVerificationStatus =
  | 'UNPROBED_PUBLIC_CLAIM'
  | 'NOT_OBSERVED';

export type ContactConflictState =
  | 'NO_CONFLICT'
  | 'CONFLICT_DETECTED'
  | 'MULTIPLE_CONSISTENT'
  | 'NOT_APPLICABLE';

export type ContactQualityState =
  | 'OBSERVED_VALID_SYNTAX'
  | 'OBSERVED_AMBIGUOUS'
  | 'CONFLICT_DETECTED'
  | 'OBSERVED_INVALID'
  | 'NOT_OBSERVED';

export interface ContactObservation {
  sourceUrl?: string;
  id: string;
  type: ContactFieldType;
  rawValue: string;
  normalizedValue?: string;
  sourceSurface: ContactSourceSurface;
  syntaxState: ContactSyntaxState;
  verificationStatus: ContactVerificationStatus;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  contextSnippet?: string;
  adLibraryId?: string;
  observedAt?: string;
  evidenceReason: string;
  countryHint?: string;
  e164Format?: string;
  nationalFormat?: string;
  extension?: string;
}

export interface ContactEntityProfile {
  primaryPhone?: string;
  primaryEmail?: string;
  observedPhones: ContactObservation[];
  observedEmails: ContactObservation[];
  phoneConflict: boolean;
  emailConflict: boolean;
  phoneConflictState: ContactConflictState;
  emailConflictState: ContactConflictState;
  overallQualityState: ContactQualityState;
  diagnostics: string[];
}

/**
 * Normalizes a raw phone candidate string observed on Meta Ad Library surfaces.
 */
export function normalizeContactPhone(
  rawPhone?: string | null,
  countryHint?: string
): {
  normalized?: string;
  e164?: string;
  syntaxState: ContactSyntaxState;
  reason: string;
  extension?: string;
  nationalFormat?: string;
} {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      syntaxState: 'NOT_OBSERVED',
      reason: 'No phone number observed in ad creative or links.'
    };
  }

  const cleaned = sanitizeText(rawPhone, 100);
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return {
      syntaxState: 'SYNTAX_INVALID',
      reason: `Phone digits count (${digitsOnly.length}) is outside standard E.164 boundary (7-15 digits).`
    };
  }

  const norm = baseNormalizePhone(cleaned, countryHint);

  if (!norm.isValid) {
    if (norm.error === 'AMBIGUOUS_WITHOUT_COUNTRY_CODE' || norm.phoneState === 'PHONE_AMBIGUOUS') {
      return {
        normalized: digitsOnly,
        e164: undefined,
        syntaxState: 'AMBIGUOUS',
        reason: 'Local phone number lacks explicit international country dial code.',
        nationalFormat: digitsOnly
      };
    }
    return {
      syntaxState: 'SYNTAX_INVALID',
      reason: norm.error || 'Failed standard phone validation.'
    };
  }


  return {
    normalized: norm.e164Format || norm.nationalFormat || digitsOnly,
    e164: norm.e164Format,
    syntaxState: 'SYNTAX_VALID',
    reason: `Format validated via E.164/national standard (inferred: ${norm.countryInference}).`,
    extension: norm.extension,
    nationalFormat: norm.nationalFormat
  };
}

/**
 * Normalizes a raw email candidate string observed on Meta Ad Library surfaces.
 */
export function normalizeContactEmail(
  rawEmail?: string | null
): {
  normalized?: string;
  syntaxState: ContactSyntaxState;
  reason: string;
  localPart?: string;
  domainPart?: string;
} {
  if (!rawEmail || !rawEmail.trim()) {
    return {
      syntaxState: 'NOT_OBSERVED',
      reason: 'No email address observed in ad creative or links.'
    };
  }

  const stripped = String(rawEmail).trim().replace(/^[<(\["']+|[>)\]"']+$/g, '').trim();
  const cleaned = sanitizeText(stripped, 254);
  const norm = baseNormalizeEmail(cleaned);

  if (!norm.isValid) {
    return {
      syntaxState: 'SYNTAX_INVALID',
      reason: norm.error || 'Invalid RFC 5322 email syntax.'
    };
  }

  const domain = norm.domainPart.toLowerCase();

  // Check for placeholder / example domains
  if (PLACEHOLDER_EMAIL_DOMAINS.has(domain)) {
    return {
      normalized: norm.normalizedEmail,
      syntaxState: 'SYNTAX_INVALID',
      reason: `Email domain "${domain}" is a known placeholder/vendor domain, not a private business contact.`,
      localPart: norm.localPart,
      domainPart: domain
    };
  }

  // Check for suspicious single-char or malformed domain components
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return {
      syntaxState: 'SYNTAX_INVALID',
      reason: 'Email domain lacks valid top-level domain.'
    };
  }

  return {
    normalized: norm.normalizedEmail,
    syntaxState: 'SYNTAX_VALID',
    reason: 'RFC 5322 compliant syntax validated.',
    localPart: norm.localPart,
    domainPart: domain
  };
}

/**
 * Extracts public contact observations from a text snippet (e.g. ad body copy).
 */
export function extractContactsFromText(
  text: string,
  sourceSurface: ContactSourceSurface = 'AD_BODY_TEXT',
  libraryId?: string,
  countryHint?: string
): { phones: ContactObservation[]; emails: ContactObservation[] } {
  const phones: ContactObservation[] = [];
  const emails: ContactObservation[] = [];

  if (!text || typeof text !== 'string') return { phones, emails };

  // 1. Regex for extracting potential email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let emailMatch: RegExpExecArray | null;
  const seenEmails = new Set<string>();

  while ((emailMatch = emailRegex.exec(text)) !== null) {
    const raw = emailMatch[0];
    const lower = raw.toLowerCase();
    if (seenEmails.has(lower)) continue;
    seenEmails.add(lower);

    const normRes = normalizeContactEmail(raw);
    const startIdx = Math.max(0, emailMatch.index - 25);
    const endIdx = Math.min(text.length, emailMatch.index + raw.length + 25);
    const contextSnippet = text.substring(startIdx, endIdx).replace(/\s+/g, ' ').trim();

    emails.push({
      id: `email_${libraryId || 'anon'}_${emails.length + 1}`,
      type: 'EMAIL',
      rawValue: raw,
      normalizedValue: normRes.normalized,
      sourceSurface,
      syntaxState: normRes.syntaxState,
      verificationStatus: normRes.syntaxState === 'SYNTAX_VALID' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
      confidence: normRes.syntaxState === 'SYNTAX_VALID' ? 'HIGH' : 'LOW',
      contextSnippet,
      adLibraryId: libraryId,
      observedAt: new Date().toISOString(),
      evidenceReason: normRes.reason
    });
  }

  // 2. Regex for extracting potential phone numbers:
  // Catches international (+1, +44, +880), US standard ((555) 123-4567, 555-123-4567), and common formats
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,5}\b/g;
  let phoneMatch: RegExpExecArray | null;
  const seenPhones = new Set<string>();

  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
    const raw = phoneMatch[0].trim();
    // Exclude strings that look like single numbers, dates (2024-10-15), or pure years
    const digitsOnly = raw.replace(/[^0-9]/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) continue;
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) continue; // Date pattern
    if (seenPhones.has(digitsOnly)) continue;
    seenPhones.add(digitsOnly);

    const normRes = normalizeContactPhone(raw, countryHint);
    const startIdx = Math.max(0, phoneMatch.index - 25);
    const endIdx = Math.min(text.length, phoneMatch.index + raw.length + 25);
    const contextSnippet = text.substring(startIdx, endIdx).replace(/\s+/g, ' ').trim();

    phones.push({
      id: `phone_${libraryId || 'anon'}_${phones.length + 1}`,
      type: 'PHONE',
      rawValue: raw,
      normalizedValue: normRes.normalized,
      sourceSurface,
      syntaxState: normRes.syntaxState,
      verificationStatus: normRes.syntaxState === 'SYNTAX_VALID' || normRes.syntaxState === 'AMBIGUOUS' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
      confidence: normRes.syntaxState === 'SYNTAX_VALID' ? 'HIGH' : normRes.syntaxState === 'AMBIGUOUS' ? 'MEDIUM' : 'LOW',
      contextSnippet,
      adLibraryId: libraryId,
      observedAt: new Date().toISOString(),
      evidenceReason: normRes.reason,
      countryHint,
      e164Format: normRes.e164,
      nationalFormat: normRes.nationalFormat,
      extension: normRes.extension
    });
  }

  return { phones, emails };
}

/**
 * Extracts public contact observations from an ad card DOM element.
 */
export function extractContactsFromAdCard(
  cardRoot: HTMLElement,
  libraryId?: string,
  countryHint?: string
): { phones: ContactObservation[]; emails: ContactObservation[] } {
  const allPhones: ContactObservation[] = [];
  const allEmails: ContactObservation[] = [];
  const seenPhoneDigits = new Set<string>();
  const seenEmailNorms = new Set<string>();

  // 1. Inspect all anchor tags for tel:, mailto:, and whatsapp links
  const links = Array.from(cardRoot.querySelectorAll('a'));
  for (const link of links) {
    const href = link.href || link.getAttribute('href') || '';
    const linkText = (link.innerText || link.textContent || '').trim();

    // tel: links
    if (href.startsWith('tel:')) {
      const raw = href.replace(/^tel:\s*/i, '').trim();
      const normRes = normalizeContactPhone(raw, countryHint);
      const digits = raw.replace(/[^0-9]/g, '');
      if (digits && !seenPhoneDigits.has(digits)) {
        seenPhoneDigits.add(digits);
        allPhones.push({
          id: `tel_link_${libraryId || 'anon'}_${allPhones.length + 1}`,
          type: 'PHONE',
          rawValue: raw,
          normalizedValue: normRes.normalized,
          sourceSurface: 'TEL_LINK',
          syntaxState: normRes.syntaxState,
          verificationStatus: normRes.syntaxState === 'SYNTAX_VALID' || normRes.syntaxState === 'AMBIGUOUS' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
          confidence: 'HIGH',
          contextSnippet: `Link text: "${linkText}"`,
          adLibraryId: libraryId,
          observedAt: new Date().toISOString(),
          evidenceReason: `Explicit tel: anchor observed in DOM: ${normRes.reason}`,
          countryHint,
          e164Format: normRes.e164,
          nationalFormat: normRes.nationalFormat
        });
      }
    }

    // mailto: links
    if (href.startsWith('mailto:')) {
      const raw = href.replace(/^mailto:\s*/i, '').split('?')[0].trim();
      const normRes = normalizeContactEmail(raw);
      const lower = raw.toLowerCase();
      if (lower && !seenEmailNorms.has(lower)) {
        seenEmailNorms.add(lower);
        allEmails.push({
          id: `mailto_link_${libraryId || 'anon'}_${allEmails.length + 1}`,
          type: 'EMAIL',
          rawValue: raw,
          normalizedValue: normRes.normalized,
          sourceSurface: 'MAILTO_LINK',
          syntaxState: normRes.syntaxState,
          verificationStatus: normRes.syntaxState === 'SYNTAX_VALID' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
          confidence: 'HIGH',
          contextSnippet: `Link text: "${linkText}"`,
          adLibraryId: libraryId,
          observedAt: new Date().toISOString(),
          evidenceReason: `Explicit mailto: anchor observed in DOM: ${normRes.reason}`
        });
      }
    }

    // WhatsApp links: wa.me/<phone> or api.whatsapp.com/send?phone=<phone>
    if (href.includes('wa.me/') || href.includes('api.whatsapp.com/send')) {
      let rawPhone = '';
      if (href.includes('wa.me/')) {
        const match = href.match(/wa\.me\/([0-9+]+)/i);
        if (match) rawPhone = match[1];
      } else {
        try {
          const u = new URL(href);
          rawPhone = u.searchParams.get('phone') || '';
        } catch {
          // ignore url parse failure
        }
      }

      if (rawPhone) {
        const intlPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
        const normRes = normalizeContactPhone(intlPhone, countryHint);
        const digits = rawPhone.replace(/[^0-9]/g, '');
        if (digits && !seenPhoneDigits.has(digits)) {
          seenPhoneDigits.add(digits);
          allPhones.push({
            id: `wa_link_${libraryId || 'anon'}_${allPhones.length + 1}`,
            type: 'PHONE',
            rawValue: rawPhone,
            normalizedValue: normRes.normalized,
            sourceSurface: 'WHATSAPP_LINK',
            syntaxState: normRes.syntaxState,
            verificationStatus: normRes.syntaxState === 'SYNTAX_VALID' || normRes.syntaxState === 'AMBIGUOUS' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
            confidence: 'HIGH',
            contextSnippet: `WhatsApp link destination: ${href.substring(0, 60)}`,
            adLibraryId: libraryId,
            observedAt: new Date().toISOString(),
            evidenceReason: `WhatsApp direct link observed in ad card: ${normRes.reason}`,
            countryHint,
            e164Format: normRes.e164,
            nationalFormat: normRes.nationalFormat
          });
        }
      }
    }
  }

  // 2. Inspect visible full text of the card
  const fullText = cardRoot.innerText || cardRoot.textContent || '';
  const textContacts = extractContactsFromText(fullText, 'AD_BODY_TEXT', libraryId, countryHint);

  for (const p of textContacts.phones) {
    const digits = p.rawValue.replace(/[^0-9]/g, '');
    if (!seenPhoneDigits.has(digits)) {
      seenPhoneDigits.add(digits);
      allPhones.push(p);
    }
  }

  for (const e of textContacts.emails) {
    const lower = e.rawValue.toLowerCase();
    if (!seenEmailNorms.has(lower)) {
      seenEmailNorms.add(lower);
      allEmails.push(e);
    }
  }

  return { phones: allPhones, emails: allEmails };
}

/**
 * Aggregates multiple ad-level contact observations for an advertiser entity,
 * identifying primary contacts, detecting conflicts, and evaluating overall quality.
 */
export function aggregateContactObservations(
  observations: ContactObservation[]
): ContactEntityProfile {
  const profile: ContactEntityProfile = {
    observedPhones: [],
    observedEmails: [],
    phoneConflict: false,
    emailConflict: false,
    phoneConflictState: 'NOT_APPLICABLE',
    emailConflictState: 'NOT_APPLICABLE',
    overallQualityState: 'NOT_OBSERVED',
    diagnostics: []
  };

  if (!observations || observations.length === 0) {
    return profile;
  }

  const phoneObs = observations.filter(o => o.type === 'PHONE');
  const emailObs = observations.filter(o => o.type === 'EMAIL');

  profile.observedPhones = phoneObs;
  profile.observedEmails = emailObs;

  // 1. Analyze Phone Observations & Conflicts
  if (phoneObs.length > 0) {
    const validPhones = phoneObs.filter(p => p.syntaxState === 'SYNTAX_VALID' || p.syntaxState === 'AMBIGUOUS');
    // Group distinct normalized / digits
    const distinctPhoneKeys = new Set<string>();
    for (const p of validPhones) {
      const key = p.e164Format || p.normalizedValue || p.rawValue.replace(/[^0-9]/g, '');
      if (key) distinctPhoneKeys.add(key);
    }

    if (distinctPhoneKeys.size > 1) {
      profile.phoneConflict = true;
      profile.phoneConflictState = 'CONFLICT_DETECTED';
      profile.diagnostics.push(`Observed ${distinctPhoneKeys.size} conflicting phone numbers across observed business sources: ${Array.from(distinctPhoneKeys).join(', ')}`);
    } else if (distinctPhoneKeys.size === 1) {
      profile.phoneConflict = false;
      profile.phoneConflictState = phoneObs.length > 1 ? 'MULTIPLE_CONSISTENT' : 'NO_CONFLICT';
    } else {
      profile.phoneConflict = false;
      profile.phoneConflictState = 'NOT_APPLICABLE';
    }

    // Select primary phone: prioritize TEL_LINK, WHATSAPP_LINK, then high confidence
    const sortedPhones = [...validPhones].sort((a, b) => {
      const surfaceRank = (s: ContactSourceSurface) => (s === 'FACEBOOK_PAGE_ABOUT' ? 4 : s === 'TEL_LINK' ? 3 : s === 'WHATSAPP_LINK' ? 2 : 1);
      return surfaceRank(b.sourceSurface) - surfaceRank(a.sourceSurface);
    });

    if (sortedPhones.length > 0) {
      profile.primaryPhone = sortedPhones[0].normalizedValue || sortedPhones[0].rawValue;
    }
  }

  // 2. Analyze Email Observations & Conflicts
  if (emailObs.length > 0) {
    const validEmails = emailObs.filter(e => e.syntaxState === 'SYNTAX_VALID');
    const distinctEmailKeys = new Set<string>();
    for (const e of validEmails) {
      const key = (e.normalizedValue || e.rawValue).toLowerCase();
      if (key) distinctEmailKeys.add(key);
    }

    if (distinctEmailKeys.size > 1) {
      profile.emailConflict = true;
      profile.emailConflictState = 'CONFLICT_DETECTED';
      profile.diagnostics.push(`Observed ${distinctEmailKeys.size} conflicting email addresses across observed business sources: ${Array.from(distinctEmailKeys).join(', ')}`);
    } else if (distinctEmailKeys.size === 1) {
      profile.emailConflict = false;
      profile.emailConflictState = emailObs.length > 1 ? 'MULTIPLE_CONSISTENT' : 'NO_CONFLICT';
    } else {
      profile.emailConflict = false;
      profile.emailConflictState = 'NOT_APPLICABLE';
    }

    // Select primary email: prioritize MAILTO_LINK then first valid
    const sortedEmails = [...validEmails].sort((a, b) => {
      const surfaceRank = (s: ContactSourceSurface) => (s === 'FACEBOOK_PAGE_ABOUT' ? 3 : s === 'MAILTO_LINK' ? 2 : 1);
      return surfaceRank(b.sourceSurface) - surfaceRank(a.sourceSurface);
    });

    if (sortedEmails.length > 0) {
      profile.primaryEmail = sortedEmails[0].normalizedValue || sortedEmails[0].rawValue;
    }
  }

  // 3. Determine Overall Quality State
  if (profile.phoneConflict || profile.emailConflict) {
    profile.overallQualityState = 'CONFLICT_DETECTED';
  } else if (profile.primaryPhone || profile.primaryEmail) {
    profile.overallQualityState = 'OBSERVED_VALID_SYNTAX';
  } else if (phoneObs.some(p => p.syntaxState === 'AMBIGUOUS') || emailObs.some(e => e.syntaxState === 'AMBIGUOUS')) {
    profile.overallQualityState = 'OBSERVED_AMBIGUOUS';
  } else if (phoneObs.some(p => p.syntaxState === 'SYNTAX_INVALID') || emailObs.some(e => e.syntaxState === 'SYNTAX_INVALID')) {
    profile.overallQualityState = 'OBSERVED_INVALID';
  } else {
    profile.overallQualityState = 'NOT_OBSERVED';
  }

  return profile;
}

/**
 * Merges incoming contact observations into an existing entity profile idempotently.
 */
export function mergeContactObservations(
  existingProfile: ContactEntityProfile | undefined,
  incoming: ContactObservation[]
): ContactEntityProfile {
  const existingObs = existingProfile
    ? [...existingProfile.observedPhones, ...existingProfile.observedEmails]
    : [];

  const combined: ContactObservation[] = [...existingObs];
  const seenSignatures = new Set(existingObs.map(o => `${o.type}_${o.sourceSurface}_${(o.normalizedValue || o.rawValue).toLowerCase()}`));

  for (const obs of incoming) {
    const sig = `${obs.type}_${obs.sourceSurface}_${(obs.normalizedValue || obs.rawValue).toLowerCase()}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      combined.push(obs);
    }
  }

  return aggregateContactObservations(combined);
}
