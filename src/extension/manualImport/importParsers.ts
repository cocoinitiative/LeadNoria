/**
 * LeadNoria Phase 34 — Manual Import Parsers
 *
 * Implements local-only, formula-safe parsing for user-supplied Meta Ad Library signals:
 * 1. Manual Ad Text Paste
 * 2. Meta Ad Library URL References
 * 3. User-Supplied CSV Import
 *
 * MANDATORY SAFETY CONSTRAINTS:
 * - Local text parsing only.
 * - STRICTLY NO network requests (no fetch, no XHR, no background scraping).
 * - Never fetch or inspect Meta Ad Library URLs or advertiser websites.
 * - Spreadsheet formula injection prevention on all CSV inputs.
 * - Never invent missing fields. Incomplete records remain unqualified.
 */

import type { ScrapedAdCandidate, ContactObservation } from '../types.ts';
import { extractContactsFromText, normalizeContactPhone, normalizeContactEmail } from '../contactQuality.ts';
import { classifyCta, classifyDestination } from '../destinationClassifier.ts';

export interface ParseResult {
  candidates: ScrapedAdCandidate[];
  warnings: string[];
  totalDetected: number;
  skippedCount?: number;
  columnMapping?: Record<string, string>;
}

/**
 * Sanitizes input string to prevent spreadsheet formula injection.
 * Disarms leading =, +, -, @, \t, \r characters.
 */
export function sanitizeFormulaValue(val: string): string {
  if (!val || typeof val !== 'string') return '';
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val.trim();
}

const COMMON_META_CTAS = [
  'Shop Now',
  'Learn More',
  'Send Message',
  'Contact Us',
  'Call Now',
  'Sign Up',
  'Order Now',
  'Book Now',
  'Apply Now',
  'Get Quote',
  'WhatsApp',
  'Get Offer',
  'Watch More',
  'Install Now',
  'Subscribe',
  'Donate Now',
  'Listen Now',
  'Request Time',
  'See Menu'
];

/**
 * Splits raw pasted ad text into individual ad blocks.
 */
function splitAdBlocks(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // Check for explicit delimiter: "---" or "==="
  if (/(?:^|\n)[-=_]{3,}(?:\n|$)/.test(normalized)) {
    return normalized
      .split(/(?:^|\n)[-=_]{3,}(?:\n|$)/)
      .map(b => b.trim())
      .filter(b => b.length > 0);
  }

  // Check for multiple "Library ID" or "Ad ID" boundaries
  const idBoundaryRegex = /(?=(?:^|\n)(?:Library\s*ID|Ad\s*ID|ID)\s*[:=]\s*\d{8,25})/i;
  const blocks = normalized.split(idBoundaryRegex).map(b => b.trim()).filter(b => b.length > 0);
  if (blocks.length > 1) {
    return blocks;
  }

  // Check for double line breaks if multiple "Sponsored" headers exist
  const sponsoredMatches = normalized.match(/(?:^|\n)Sponsored(?:\n|$)/gi);
  if (sponsoredMatches && sponsoredMatches.length > 1) {
    const blocksBySponsored = normalized.split(/(?=(?:^|\n)(?:[^\n]+\n)?Sponsored(?:\n|$))/i);
    const valid = blocksBySponsored.map(b => b.trim()).filter(b => b.length > 0);
    if (valid.length > 1) return valid;
  }

  return [normalized];
}

/**
 * Mode A: Parse manually copied ad text.
 */
export function parseManualAdText(rawText: string, defaultCountry: string = 'BD'): ParseResult {
  const blocks = splitAdBlocks(rawText);
  const candidates: ScrapedAdCandidate[] = [];
  const warnings: string[] = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;

    // 1. Extract Library ID
    let libraryId = '';
    const idMatch = block.match(/(?:Library\s*ID|Ad\s*ID|ID)\s*[:=]?\s*([0-9]{8,25})/i);
    if (idMatch) {
      libraryId = idMatch[1].trim();
    } else {
      // Look for standalone 10-18 digit number on its own line
      for (const line of lines) {
        if (/^[0-9]{10,20}$/.test(line)) {
          libraryId = line;
          break;
        }
      }
    }

    if (!libraryId) {
      // Fallback synthetic identifier for manual tracking
      libraryId = `MANUAL_${Date.now()}_${idx + 1}`;
      warnings.push(`Ad #${idx + 1}: No Ad Library ID found; assigned manual identifier ${libraryId}.`);
    }

    // 2. Extract Status & Started Running Date
    let isActive = true;
    let startedRunning: string | undefined;
    for (const line of lines) {
      if (/^Inactive$/i.test(line)) isActive = false;
      if (/^Active$/i.test(line)) isActive = true;
      const startedMatch = line.match(/^Started running on\s+(.+)$/i);
      if (startedMatch) {
        startedRunning = startedMatch[1].trim();
      }
    }

    // 3. Extract Advertiser / Page Name
    let pageName = '';
    const pageLabelMatch = block.match(/(?:Page(?:\s*Name)?|Advertiser(?:\s*Name)?|Business)\s*[:=]\s*(.+)/i);
    if (pageLabelMatch) {
      pageName = pageLabelMatch[1].trim();
    } else {
      // Find line immediately before 'Sponsored'
      const sponsoredIdx = lines.findIndex(l => /^Sponsored$/i.test(l));
      if (sponsoredIdx > 0) {
        pageName = lines[sponsoredIdx - 1];
      } else {
        // Pick first line that isn't ID, status, date, or URL
        for (const line of lines) {
          if (
            !/(?:Library\s*ID|Ad\s*ID|ID)\s*[:=]/i.test(line) &&
            !/^(?:Active|Inactive|Sponsored)$/i.test(line) &&
            !/^Started running on/i.test(line) &&
            !/^https?:\/\//i.test(line) &&
            line.length >= 2 &&
            line.length <= 100
          ) {
            pageName = line;
            break;
          }
        }
      }
    }

    if (!pageName) {
      pageName = `Advertiser (Ad ${libraryId})`;
      warnings.push(`Ad #${idx + 1}: Could not definitively identify advertiser name.`);
    }

    // 4. Extract CTA
    let ctaText: string | undefined;
    const ctaLabelMatch = block.match(/(?:CTA|Call\s*to\s*Action|Button)\s*[:=]\s*(.+)/i);
    if (ctaLabelMatch) {
      ctaText = ctaLabelMatch[1].trim();
    } else {
      for (const knownCta of COMMON_META_CTAS) {
        const ctaRegex = new RegExp(`\\b${knownCta}\\b`, 'i');
        if (ctaRegex.test(block)) {
          ctaText = knownCta;
          break;
        }
      }
    }

    // 5. Extract Destination URL & Facebook Page URL
    let destinationUrl: string | undefined;
    let destinationDomain: string | undefined;
    let facebookPageUrl: string | undefined;

    const urls = block.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const u of urls) {
      try {
        const parsed = new URL(u);
        const host = parsed.hostname.toLowerCase();
        if (host.includes('facebook.com') || host.includes('fb.com')) {
          if (parsed.pathname.includes('/ads/library')) {
            // Meta Ad Library internal link, skip as destination
            continue;
          }
          if (!facebookPageUrl) {
            facebookPageUrl = u;
          }
        } else if (!destinationUrl) {
          destinationUrl = u;
          destinationDomain = host.replace(/^www\./, '');
        }
      } catch {
        // Ignore invalid URL
      }
    }

    // 6. Extract Body Copy
    const bodyLines = lines.filter(line => {
      if (line === pageName) return false;
      if (line === ctaText) return false;
      if (/(?:Library\s*ID|Ad\s*ID|ID)\s*[:=]/i.test(line)) return false;
      if (/^(?:Active|Inactive|Sponsored)$/i.test(line)) return false;
      if (/^Started running on/i.test(line)) return false;
      if (/^(?:CTA|Call\s*to\s*Action|Button|Page|Advertiser)\s*[:=]/i.test(line)) return false;
      if (destinationUrl && line.includes(destinationUrl)) return false;
      if (facebookPageUrl && line.includes(facebookPageUrl)) return false;
      return true;
    });
    const bodyCopy = bodyLines.join('\n').trim();

    // 7. Contact Extraction (Deterministic & local from copy)
    const contacts = extractContactsFromText(bodyCopy, 'AD_BODY_TEXT', libraryId, defaultCountry);

    // 8. Classify CTA & Destination
    const ctaClassification = ctaText ? classifyCta(ctaText) : undefined;
    const destClassification = classifyDestination({
      destinationUrl,
      destinationDomain,
      ctaText,
      ctaType: ctaClassification?.ctaType,
      bodyCopy,
      rawText: block
    });

    candidates.push({
      libraryId,
      pageName,
      facebookPageUrl,
      destinationUrl,
      destinationDomain,
      isActive,
      startedRunning,
      bodyCopy: bodyCopy || undefined,
      ctaText,
      ctaType: ctaClassification?.ctaType,
      destinationType: destClassification.destinationType,
      destinationReasonCode: destClassification.reasonCode,
      destinationConfidence: destClassification.confidence,
      observedKeyword: 'MANUAL_IMPORT',
      rawText: block,
      contactObservations: [...contacts.phones, ...contacts.emails],
      observedPhones: contacts.phones,
      observedEmails: contacts.emails,
      advertiserName: pageName,
      adText: bodyCopy
    });
  }

  return {
    candidates,
    warnings,
    totalDetected: candidates.length
  };
}

/**
 * Mode B: Parse Meta Ad Library URL references locally.
 * STRICT: Zero network calls. Pure string inspection.
 */
export function parseMetaAdLibraryUrls(urlInput: string, defaultCountry: string = 'BD'): ParseResult {
  const lines = urlInput
    .split(/[\r\n,;]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const candidates: ScrapedAdCandidate[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    // Find URL in line
    const match = rawLine.match(/https?:\/\/[^\s"'<>]+/i);
    const urlStr = match ? match[0] : rawLine;

    let libraryId: string | null = null;
    let pageId: string | undefined;

    try {
      const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      const host = u.hostname.toLowerCase();
      if (!host.includes('facebook.com') && !host.includes('meta.com')) {
        warnings.push(`Line #${idx + 1}: "${urlStr.substring(0, 50)}" is not a recognized Meta Ad Library URL.`);
        continue;
      }

      // Check query params: id
      const idParam = u.searchParams.get('id');
      if (idParam && /^[0-9]{8,25}$/.test(idParam)) {
        libraryId = idParam;
      }

      const pId = u.searchParams.get('view_all_page_id');
      if (pId && /^[0-9]{5,25}$/.test(pId)) {
        pageId = pId;
      }
    } catch {
      // Regex fallback if URL constructor fails
      const fallbackId = urlStr.match(/[?&]id=([0-9]{8,25})/i);
      if (fallbackId) {
        libraryId = fallbackId[1];
      }
    }

    if (!libraryId) {
      warnings.push(`Line #${idx + 1}: No valid numeric Ad Library ID found in URL.`);
      continue;
    }

    if (seenIds.has(libraryId)) {
      warnings.push(`Line #${idx + 1}: Duplicate Library ID ${libraryId} skipped.`);
      continue;
    }
    seenIds.add(libraryId);

    // Incomplete URL-only candidate. Does not fabricate missing body, website or location.
    candidates.push({
      libraryId,
      pageName: `Meta Ad Library Ref #${libraryId}`,
      facebookPageId: pageId,
      facebookPageUrl: pageId ? `https://www.facebook.com/${pageId}` : undefined,
      destinationUrl: undefined,
      destinationDomain: undefined,
      isActive: true,
      bodyCopy: undefined,
      ctaText: undefined,
      destinationType: 'UNKNOWN',
      destinationConfidence: 'NONE',
      destinationReasonCode: 'URL_REFERENCE_ONLY',
      observedKeyword: 'MANUAL_URL_REFERENCE',
      rawText: `Meta Ad Library Reference: ${urlStr}`,
      contactObservations: [],
      observedPhones: [],
      observedEmails: [],
      advertiserName: `Meta Ad Library Ref #${libraryId}`
    });
  }

  return {
    candidates,
    warnings,
    totalDetected: candidates.length
  };
}

/**
 * Parses CSV text per RFC 4180 into a 2D string grid.
 */
function parseCsvGrid(csvText: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  const len = csvText.length;
  for (let i = 0; i < len; i++) {
    const char = csvText[i];
    const nextChar = i + 1 < len ? csvText[i + 1] : '';

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"' && currentField.length === 0) {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n
      } else if (char === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Final field and row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Detects CSV delimiter (, ; or \t) by counting outside quotes in first row.
 */
function detectDelimiter(firstLine: string): string {
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (c === ',') comma++;
      else if (c === ';') semi++;
      else if (c === '\t') tab++;
    }
  }

  if (tab > comma && tab > semi) return '\t';
  if (semi > comma && semi > tab) return ';';
  return ',';
}

/**
 * Normalizes header string for mapping lookup.
 */
function normalizeHeaderName(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Mode C: Parse user-supplied CSV file content.
 * Formula-safe and deterministic.
 */
export function parseUserSuppliedCsv(csvContent: string, defaultCountry: string = 'BD'): ParseResult {
  const warnings: string[] = [];
  if (!csvContent || !csvContent.trim()) {
    return { candidates: [], warnings: ['CSV content is completely empty.'], totalDetected: 0 };
  }

  const lines = csvContent.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { candidates: [], warnings: ['CSV must have a header row and at least one data row.'], totalDetected: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const grid = parseCsvGrid(csvContent.replace(/^\uFEFF/, '').trim(), delimiter);
  if (grid.length < 2) {
    return { candidates: [], warnings: ['No valid data rows found in CSV.'], totalDetected: 0 };
  }

  const rawHeaders = grid[0].map(h => sanitizeFormulaValue(h));
  const normHeaders = rawHeaders.map(normalizeHeaderName);

  // Column index resolver
  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const normAlias = normalizeHeaderName(alias);
      const idx = normHeaders.findIndex(h => h === normAlias || h.includes(normAlias));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const idCol = findCol(['library_id', 'library id', 'ad_id', 'ad id', 'adid', 'libraryid', 'id']);
  const pageNameCol = findCol(['page_name', 'page name', 'advertiser_name', 'advertiser', 'business_name', 'name', 'page']);
  const copyCol = findCol(['body_copy', 'body copy', 'ad_text', 'ad text', 'copy', 'description', 'text', 'ad_body', 'content']);
  const ctaCol = findCol(['cta_text', 'cta', 'call_to_action', 'button', 'action']);
  const destCol = findCol(['destination_url', 'destination', 'website', 'url', 'link', 'landing_page']);
  const phoneCol = findCol(['phone', 'phone_number', 'telephone', 'mobile', 'contact_phone']);
  const emailCol = findCol(['email', 'email_address', 'contact_email', 'mail']);
  const statusCol = findCol(['status', 'active', 'ad_status']);
  const fbPageCol = findCol(['facebook_page', 'facebook_page_url', 'fb_page', 'page_url']);

  const columnMapping: Record<string, string> = {};
  if (idCol >= 0) columnMapping['Ad Library ID'] = rawHeaders[idCol];
  if (pageNameCol >= 0) columnMapping['Advertiser / Page Name'] = rawHeaders[pageNameCol];
  if (copyCol >= 0) columnMapping['Ad Copy'] = rawHeaders[copyCol];
  if (ctaCol >= 0) columnMapping['CTA'] = rawHeaders[ctaCol];
  if (destCol >= 0) columnMapping['Destination URL'] = rawHeaders[destCol];
  if (phoneCol >= 0) columnMapping['Phone'] = rawHeaders[phoneCol];
  if (emailCol >= 0) columnMapping['Email'] = rawHeaders[emailCol];

  const candidates: ScrapedAdCandidate[] = [];
  const seenIds = new Set<string>();
  let skippedCount = 0;

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every(cell => !cell.trim())) {
      skippedCount++;
      continue;
    }

    const getVal = (col: number): string => {
      if (col < 0 || col >= row.length) return '';
      return sanitizeFormulaValue(row[col]);
    };

    let rawId = getVal(idCol);
    const pageName = getVal(pageNameCol);
    const bodyCopy = getVal(copyCol);
    const ctaText = getVal(ctaCol);
    const destinationUrl = getVal(destCol);
    const explicitPhone = getVal(phoneCol);
    const explicitEmail = getVal(emailCol);
    const statusVal = getVal(statusCol);
    const fbPageUrl = getVal(fbPageCol);

    // If no explicit ID, try extracting from URL or generate deterministic fallback
    if (!rawId && destinationUrl) {
      const match = destinationUrl.match(/[?&]id=([0-9]{8,25})/i);
      if (match) rawId = match[1];
    }

    if (!rawId) {
      rawId = `CSV_${r}_${Date.now()}`;
      warnings.push(`Row #${r}: Missing Ad ID; assigned placeholder ${rawId}.`);
    }

    if (seenIds.has(rawId)) {
      skippedCount++;
      warnings.push(`Row #${r}: Duplicate ID ${rawId} ignored.`);
      continue;
    }
    seenIds.add(rawId);

    const isActive = !/^inactive$/i.test(statusVal);

    // Parse destination domain safely
    let destinationDomain: string | undefined;
    if (destinationUrl) {
      try {
        const u = new URL(destinationUrl.startsWith('http') ? destinationUrl : `https://${destinationUrl}`);
        destinationDomain = u.hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        // invalid URL
      }
    }

    // Contacts
    const observedPhones: ContactObservation[] = [];
    const observedEmails: ContactObservation[] = [];

    if (explicitPhone) {
      const normPhone = normalizeContactPhone(explicitPhone, defaultCountry);
      observedPhones.push({
        id: `csv_phone_${rawId}_1`,
        type: 'PHONE',
        rawValue: explicitPhone,
        normalizedValue: normPhone.normalized,
        sourceSurface: 'AD_BODY_TEXT',
        syntaxState: normPhone.syntaxState,
        verificationStatus: normPhone.syntaxState === 'SYNTAX_VALID' || normPhone.syntaxState === 'AMBIGUOUS' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
        confidence: normPhone.syntaxState === 'SYNTAX_VALID' ? 'HIGH' : 'MEDIUM',
        adLibraryId: rawId,
        observedAt: new Date().toISOString(),
        evidenceReason: `Supplied in CSV: ${normPhone.reason}`,
        countryHint: defaultCountry,
        e164Format: normPhone.e164,
        nationalFormat: normPhone.nationalFormat
      });
    }

    if (explicitEmail) {
      const normEmail = normalizeContactEmail(explicitEmail);
      observedEmails.push({
        id: `csv_email_${rawId}_1`,
        type: 'EMAIL',
        rawValue: explicitEmail,
        normalizedValue: normEmail.normalized,
        sourceSurface: 'AD_BODY_TEXT',
        syntaxState: normEmail.syntaxState,
        verificationStatus: normEmail.syntaxState === 'SYNTAX_VALID' ? 'UNPROBED_PUBLIC_CLAIM' : 'NOT_OBSERVED',
        confidence: normEmail.syntaxState === 'SYNTAX_VALID' ? 'HIGH' : 'LOW',
        adLibraryId: rawId,
        observedAt: new Date().toISOString(),
        evidenceReason: `Supplied in CSV: ${normEmail.reason}`
      });
    }

    // If body copy exists and contacts were not in dedicated columns, extract from body copy
    if (bodyCopy && observedPhones.length === 0 && observedEmails.length === 0) {
      const extracted = extractContactsFromText(bodyCopy, 'AD_BODY_TEXT', rawId, defaultCountry);
      observedPhones.push(...extracted.phones);
      observedEmails.push(...extracted.emails);
    }

    const ctaClassification = ctaText ? classifyCta(ctaText) : undefined;
    const destClassification = classifyDestination({
      destinationUrl,
      destinationDomain,
      ctaText,
      ctaType: ctaClassification?.ctaType,
      bodyCopy
    });

    candidates.push({
      libraryId: rawId,
      pageName: pageName || `Advertiser (Row ${r})`,
      facebookPageUrl: fbPageUrl || undefined,
      destinationUrl: destinationUrl || undefined,
      destinationDomain,
      isActive,
      bodyCopy: bodyCopy || undefined,
      ctaText: ctaText || undefined,
      ctaType: ctaClassification?.ctaType,
      destinationType: destClassification.destinationType,
      destinationReasonCode: destClassification.reasonCode,
      destinationConfidence: destClassification.confidence,
      observedKeyword: 'USER_CSV_IMPORT',
      rawText: `${pageName} | ${bodyCopy} | ${ctaText} | ${destinationUrl}`,
      contactObservations: [...observedPhones, ...observedEmails],
      observedPhones,
      observedEmails,
      advertiserName: pageName,
      adText: bodyCopy
    });
  }

  return {
    candidates,
    warnings,
    totalDetected: candidates.length,
    skippedCount,
    columnMapping
  };
}
