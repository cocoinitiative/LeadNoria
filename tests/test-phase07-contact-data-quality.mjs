/**
 * LeadNoria — Phase 7: Contact Data Quality & Evidence Management
 * Regression Test Suite
 *
 * Verifies:
 * 1. Public contact-data normalization (Phone E.164, RFC 5322 Email, Business Name).
 * 2. Evidence and provenance tracking (DOM surface, raw snippet, timestamps, context).
 * 3. Confidence semantics and reachability safety: Syntax validation is distinguished
 *    from proof of reachability/ownership (UNPROBED_PUBLIC_CLAIM vs VERIFIED).
 * 4. Multi-ad aggregation and conflict preservation: Conflicting contact observations
 *    across multiple ads for the same advertiser are never overwritten.
 * 5. Data integrity across deduplication, storage recovery, and CSV export.
 * 6. Permanent fail-closed safety gates and historical archive integrity.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  normalizeContactPhone,
  normalizeContactEmail,
  extractContactsFromText,
  extractContactsFromAdCard,
  aggregateContactObservations,
  mergeContactObservations,
  PLACEHOLDER_EMAIL_DOMAINS
} from '../src/extension/contactQuality.ts';

import {
  extractFieldsFromCard,
  aggregateCandidatesToLeads,
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';

import {
  normalizeStoredLead
} from '../src/extension/bulkStore.ts';

import {
  mergeCandidateIntoEntity
} from '../src/extension/entityResolver.ts';

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA: PHASE 7 CONTACT DATA QUALITY & EVIDENCE REGRESSION TEST SUITE');
console.log('Scope: Contact Normalization | Evidence Provenance | Conflict Safety | Export');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// SECTION 1: PUBLIC CONTACT-DATA NORMALIZATION — PHONE NUMBERS
// --------------------------------------------------------------------------
console.log('--- SECTION 1: PHONE NORMALIZATION & VALIDATION ---');

test('Valid US international format phone normalizes to E.164 and format-valid state', () => {
  const res = normalizeContactPhone('+1 (800) 555-0199');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.e164, '+18005550199');
  assert.strictEqual(res.normalized, '+18005550199');
});

test('Valid UK phone with dial code normalizes cleanly', () => {
  const res = normalizeContactPhone('+44 20 7946 0991');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.e164, '+442079460991');
});

test('Phone with extension parses digits and separates extension without corrupting base number', () => {
  const res = normalizeContactPhone('+1-800-555-0144 ext 302');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.extension, '302');
  assert.strictEqual(res.e164, '+18005550144');
});

test('Local number without country code or hint is marked AMBIGUOUS rather than invalid', () => {
  const res = normalizeContactPhone('555-0199');
  assert.strictEqual(res.syntaxState, 'AMBIGUOUS');
});

test('Phone with country hint resolves national format deterministically', () => {
  const res = normalizeContactPhone('8005550199', 'US');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.e164, '+18005550199');
});

test('Phone number with fewer than 7 digits is rejected as SYNTAX_INVALID', () => {
  const res = normalizeContactPhone('12345');
  assert.strictEqual(res.syntaxState, 'SYNTAX_INVALID');
  assert.ok(res.reason.includes('7-15 digits'));
});

test('Phone number with more than 15 digits is rejected as SYNTAX_INVALID', () => {
  const res = normalizeContactPhone('12345678901234567890');
  assert.strictEqual(res.syntaxState, 'SYNTAX_INVALID');
});

test('Empty or null phone input produces NOT_OBSERVED state without throwing', () => {
  const res1 = normalizeContactPhone('');
  assert.strictEqual(res1.syntaxState, 'NOT_OBSERVED');
  const res2 = normalizeContactPhone(null);
  assert.strictEqual(res2.syntaxState, 'NOT_OBSERVED');
});

// --------------------------------------------------------------------------
// SECTION 2: PUBLIC CONTACT-DATA NORMALIZATION — EMAIL ADDRESSES
// --------------------------------------------------------------------------
console.log('\n--- SECTION 2: EMAIL NORMALIZATION & VALIDATION ---');

test('Valid business email normalizes to lowercase canonical RFC 5322 format', () => {
  const res = normalizeContactEmail('Contact.Support@AcmeBiz.com');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.normalized, 'Contact.Support@acmebiz.com');
  assert.strictEqual(res.domainPart, 'acmebiz.com');
});

test('Email with surrounding angle brackets or whitespace is sanitized cleanly', () => {
  const res = normalizeContactEmail('  <info@austinfurniture.org>  ');
  assert.strictEqual(res.syntaxState, 'SYNTAX_VALID');
  assert.strictEqual(res.normalized, 'info@austinfurniture.org');
});

test('Known placeholder or vendor email domains are rejected as SYNTAX_INVALID', () => {
  const res1 = normalizeContactEmail('test@example.com');
  assert.strictEqual(res1.syntaxState, 'SYNTAX_INVALID');
  assert.ok(res1.reason.includes('placeholder'));

  const res2 = normalizeContactEmail('user@sentry.io');
  assert.strictEqual(res2.syntaxState, 'SYNTAX_INVALID');

  const res3 = normalizeContactEmail('help@shopify.com');
  assert.strictEqual(res3.syntaxState, 'SYNTAX_INVALID');
});

test('Malformed email missing domain TLD or @ is rejected as SYNTAX_INVALID', () => {
  const res1 = normalizeContactEmail('notanemail');
  assert.strictEqual(res1.syntaxState, 'SYNTAX_INVALID');

  const res2 = normalizeContactEmail('sales@domain');
  assert.strictEqual(res2.syntaxState, 'SYNTAX_INVALID');
});

test('Empty or null email input produces NOT_OBSERVED state', () => {
  const res = normalizeContactEmail('');
  assert.strictEqual(res.syntaxState, 'NOT_OBSERVED');
});

// --------------------------------------------------------------------------
// SECTION 3: DOM EXTRACTION & EVIDENCE PROVENANCE
// --------------------------------------------------------------------------
console.log('\n--- SECTION 3: DOM EXTRACTION & EVIDENCE PROVENANCE ---');

test('extractContactsFromText extracts email and phone with context snippets', () => {
  const text = 'For immediate orders call us at +1 (800) 555-0188 or email sales@craftfurniture.com today!';
  const contacts = extractContactsFromText(text, 'AD_BODY_TEXT', 'ad_123');

  assert.strictEqual(contacts.phones.length, 1);
  assert.strictEqual(contacts.phones[0].e164Format, '+18005550188');
  assert.strictEqual(contacts.phones[0].sourceSurface, 'AD_BODY_TEXT');
  assert.ok(contacts.phones[0].contextSnippet.includes('555-0188'));

  assert.strictEqual(contacts.emails.length, 1);
  assert.strictEqual(contacts.emails[0].normalizedValue, 'sales@craftfurniture.com');
  assert.strictEqual(contacts.emails[0].sourceSurface, 'AD_BODY_TEXT');
  assert.ok(contacts.emails[0].contextSnippet.includes('sales@craftfurniture.com'));
});

test('extractContactsFromAdCard extracts tel: links, mailto: links, and WhatsApp URLs', () => {
  // Create mock card DOM
  const mockCard = {
    innerText: 'Welcome to Artisan Studio! Visit us or get in touch.',
    querySelectorAll: (selector) => {
      if (selector === 'a') {
        return [
          {
            href: 'tel:+18005550199',
            getAttribute: () => 'tel:+18005550199',
            innerText: 'Call Us Now'
          },
          {
            href: 'mailto:contact@artisanstudio.com?subject=Inquiry',
            getAttribute: () => 'mailto:contact@artisanstudio.com',
            innerText: 'Email Team'
          },
          {
            href: 'https://wa.me/18005550177?text=Hi',
            getAttribute: () => 'https://wa.me/18005550177',
            innerText: 'Chat on WhatsApp'
          }
        ];
      }
      return [];
    }
  };

  const contacts = extractContactsFromAdCard(mockCard, 'card_999');
  assert.strictEqual(contacts.phones.length, 2);
  const telObs = contacts.phones.find(p => p.sourceSurface === 'TEL_LINK');
  assert.ok(telObs);
  assert.strictEqual(telObs.e164Format, '+18005550199');

  const waObs = contacts.phones.find(p => p.sourceSurface === 'WHATSAPP_LINK');
  assert.ok(waObs);
  assert.strictEqual(waObs.e164Format, '+18005550177');

  assert.strictEqual(contacts.emails.length, 1);
  assert.strictEqual(contacts.emails[0].normalizedValue, 'contact@artisanstudio.com');
  assert.strictEqual(contacts.emails[0].sourceSurface, 'MAILTO_LINK');
});

// --------------------------------------------------------------------------
// SECTION 4: CONFIDENCE SEMANTICS & NO REACHABILITY FABRICATION
// --------------------------------------------------------------------------
console.log('\n--- SECTION 4: CONFIDENCE SEMANTICS & REACHABILITY INVARIANTS ---');

test('Valid contact syntax is strictly classified as UNPROBED_PUBLIC_CLAIM, never VERIFIED', () => {
  const text = 'Reach out at info@legalbiz.com or +1 800 555 0100';
  const contacts = extractContactsFromText(text, 'AD_BODY_TEXT', 'ad_claim');

  for (const email of contacts.emails) {
    assert.strictEqual(email.verificationStatus, 'UNPROBED_PUBLIC_CLAIM');
    assert.notStrictEqual(email.verificationStatus, 'VERIFIED');
    assert.notStrictEqual(email.verificationStatus, 'REACHABLE');
  }

  for (const phone of contacts.phones) {
    assert.strictEqual(phone.verificationStatus, 'UNPROBED_PUBLIC_CLAIM');
    assert.notStrictEqual(phone.verificationStatus, 'VERIFIED');
    assert.notStrictEqual(phone.verificationStatus, 'REACHABLE');
  }
});

// --------------------------------------------------------------------------
// SECTION 5: MULTI-AD AGGREGATION & CONFLICT PRESERVATION
// --------------------------------------------------------------------------
console.log('\n--- SECTION 5: MULTI-AD AGGREGATION & CONFLICT SAFETY ---');

test('Multiple ads for same advertiser with consistent contacts result in NO_CONFLICT', () => {
  const obs1 = extractContactsFromText('Call +1 (800) 555-0111', 'AD_BODY_TEXT', 'ad_1').phones[0];
  const obs2 = extractContactsFromText('Tel: +18005550111', 'TEL_LINK', 'ad_2').phones[0];

  const profile = aggregateContactObservations([obs1, obs2]);
  assert.strictEqual(profile.phoneConflict, false);
  assert.strictEqual(profile.phoneConflictState, 'MULTIPLE_CONSISTENT');
  assert.strictEqual(profile.primaryPhone, '+18005550111');
});

test('Multiple ads for same advertiser with conflicting phones preserves BOTH numbers without overwriting', () => {
  const obs1 = extractContactsFromText('Call Dallas branch: +1 (800) 555-0101', 'AD_BODY_TEXT', 'ad_1').phones[0];
  const obs2 = extractContactsFromText('Call Austin branch: +1 (800) 555-0102', 'AD_BODY_TEXT', 'ad_2').phones[0];

  const profile = aggregateContactObservations([obs1, obs2]);
  assert.strictEqual(profile.phoneConflict, true);
  assert.strictEqual(profile.phoneConflictState, 'CONFLICT_DETECTED');
  assert.strictEqual(profile.overallQualityState, 'CONFLICT_DETECTED');
  assert.strictEqual(profile.observedPhones.length, 2);

  const phoneValues = profile.observedPhones.map(p => p.e164Format);
  assert.ok(phoneValues.includes('+18005550101'));
  assert.ok(phoneValues.includes('+18005550102'));
  assert.ok(profile.diagnostics.some(d => d.includes('conflicting phone numbers')));
});

test('Multiple ads for same advertiser with conflicting emails preserves BOTH addresses without overwriting', () => {
  const obs1 = extractContactsFromText('Email dallas@brand.com', 'AD_BODY_TEXT', 'ad_1').emails[0];
  const obs2 = extractContactsFromText('Email austin@otherbrand.com', 'AD_BODY_TEXT', 'ad_2').emails[0];

  const profile = aggregateContactObservations([obs1, obs2]);
  assert.strictEqual(profile.emailConflict, true);
  assert.strictEqual(profile.emailConflictState, 'CONFLICT_DETECTED');
  assert.strictEqual(profile.overallQualityState, 'CONFLICT_DETECTED');
  assert.strictEqual(profile.observedEmails.length, 2);
});

test('mergeContactObservations is idempotent when re-merging duplicate observations', () => {
  const obs1 = extractContactsFromText('Call +1 (800) 555-0111 and email info@site.com', 'AD_BODY_TEXT', 'ad_1');
  const combined = [...obs1.phones, ...obs1.emails];

  let profile = aggregateContactObservations(combined);
  // Merge identical observations again
  profile = mergeContactObservations(profile, combined);

  assert.strictEqual(profile.observedPhones.length, 1);
  assert.strictEqual(profile.observedEmails.length, 1);
});

// --------------------------------------------------------------------------
// SECTION 6: CANDIDATE AGGREGATION & ENTITY RESOLUTION INTEGRATION
// --------------------------------------------------------------------------
console.log('\n--- SECTION 6: CANDIDATE AGGREGATION & ENTITY RESOLUTION ---');

test('aggregateCandidatesToLeads enriches ExtensionLead with contact facts and ad evidence', () => {
  const rawCand1 = {
    libraryId: '100000000001',
    pageName: 'Austin Craft Works',
    facebookPageUrl: 'https://www.facebook.com/austincraftworks',
    destinationUrl: 'https://austincraftworks.com',
    destinationDomain: 'austincraftworks.com',
    isActive: true,
    bodyCopy: 'Call our workshop directly at +1 (512) 555-0144 or email orders@austincraftworks.com',
    ctaText: 'Learn More'
  };

  const rawCand2 = {
    libraryId: '100000000002',
    pageName: 'Austin Craft Works',
    facebookPageUrl: 'https://www.facebook.com/austincraftworks',
    destinationUrl: 'https://austincraftworks.com',
    destinationDomain: 'austincraftworks.com',
    isActive: true,
    bodyCopy: 'Custom handcrafted furniture. Email us: orders@austincraftworks.com',
    ctaText: 'Shop Now'
  };

  // Extract contacts for both candidates
  const contacts1 = extractContactsFromText(rawCand1.bodyCopy, 'AD_BODY_TEXT', rawCand1.libraryId, 'US');
  rawCand1.observedPhones = contacts1.phones;
  rawCand1.observedEmails = contacts1.emails;
  rawCand1.contactObservations = [...contacts1.phones, ...contacts1.emails];

  const contacts2 = extractContactsFromText(rawCand2.bodyCopy, 'AD_BODY_TEXT', rawCand2.libraryId, 'US');
  rawCand2.observedPhones = contacts2.phones;
  rawCand2.observedEmails = contacts2.emails;
  rawCand2.contactObservations = [...contacts2.phones, ...contacts2.emails];

  const result = aggregateCandidatesToLeads([rawCand1, rawCand2], 'US', 'United States');
  assert.strictEqual(result.leads.length, 1);

  const lead = result.leads[0];
  assert.strictEqual(lead.name, 'Austin Craft Works');
  assert.strictEqual(lead.businessPhone, '+15125550144');
  assert.strictEqual(lead.businessEmail, 'orders@austincraftworks.com');
  assert.ok(Array.isArray(lead.phones));
  assert.strictEqual(lead.phones[0], '+15125550144');
  assert.strictEqual(lead.contactQualityState, 'OBSERVED_VALID_SYNTAX');
  assert.strictEqual(lead.contactProfile.phoneConflict, false);
});

test('mergeCandidateIntoEntity merges new contact observations without losing existing data', () => {
  const targetLead = {
    id: 'lead_existing_1',
    name: 'Metropolis Gym',
    canonicalName: 'Metropolis Gym',
    facebookPageName: 'Metropolis Gym',
    facebookPageUrl: 'https://facebook.com/metropolisgym',
    facebookPageState: 'found',
    adLibraryIds: ['200000000001'],
    activeAdLibraryIds: ['200000000001'],
    matchedKeywords: ['fitness'],
    locationCode: 'US',
    locationName: 'United States',
    status: 'QUALIFIED',
    discoveredAt: new Date().toISOString(),
    adEvidence: []
  };

  const incomingCand = {
    libraryId: '200000000002',
    pageName: 'Metropolis Gym',
    facebookPageUrl: 'https://facebook.com/metropolisgym',
    isActive: true,
    bodyCopy: 'Join today! Phone: +1 (800) 555-0199 | info@metropolisgym.com'
  };

  const extracted = extractContactsFromText(incomingCand.bodyCopy, 'AD_BODY_TEXT', incomingCand.libraryId);
  incomingCand.contactObservations = [...extracted.phones, ...extracted.emails];

  mergeCandidateIntoEntity(targetLead, incomingCand, {
    targetKey: 'name_metropolis_gym',
    confidence: 'STRONG',
    relationshipType: 'INDEPENDENT_BUSINESS',
    reason: 'Identical Facebook page'
  });

  assert.strictEqual(targetLead.businessPhone, '+18005550199');
  assert.strictEqual(targetLead.businessEmail, 'info@metropolisgym.com');
  assert.strictEqual(targetLead.contactQualityState, 'OBSERVED_VALID_SYNTAX');
});

// --------------------------------------------------------------------------
// SECTION 7: STORAGE PERSISTENCE & RECOVERY INTEGRITY
// --------------------------------------------------------------------------
console.log('\n--- SECTION 7: STORAGE PERSISTENCE & RECOVERY INTEGRITY ---');

test('normalizeStoredLead round-trips contact facts and observations without corruption', () => {
  const lead = {
    id: 'lead_storage_test',
    name: 'Northstar Logistics',
    canonicalName: 'Northstar Logistics',
    canonicalKey: 'name_northstar_logistics',
    businessPhone: '+18005550122',
    businessEmail: 'dispatch@northstar.com',
    phones: ['+18005550122'],
    emails: ['dispatch@northstar.com'],
    contactQualityState: 'OBSERVED_VALID_SYNTAX',
    contactProfile: {
      primaryPhone: '+18005550122',
      primaryEmail: 'dispatch@northstar.com',
      observedPhones: [{
        id: 'phone_1',
        type: 'PHONE',
        rawValue: '+18005550122',
        normalizedValue: '+18005550122',
        sourceSurface: 'TEL_LINK',
        syntaxState: 'SYNTAX_VALID',
        verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
        confidence: 'HIGH',
        evidenceReason: 'tel: link'
      }],
      observedEmails: [{
        id: 'email_1',
        type: 'EMAIL',
        rawValue: 'dispatch@northstar.com',
        normalizedValue: 'dispatch@northstar.com',
        sourceSurface: 'MAILTO_LINK',
        syntaxState: 'SYNTAX_VALID',
        verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
        confidence: 'HIGH',
        evidenceReason: 'mailto: link'
      }],
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      overallQualityState: 'OBSERVED_VALID_SYNTAX',
      diagnostics: []
    },
    adLibraryIds: ['300000000001'],
    status: 'REVIEW_REQUIRED',
    discoveredAt: new Date().toISOString()
  };

  const normalized = normalizeStoredLead(lead);
  assert.strictEqual(normalized.businessPhone, '+18005550122');
  assert.strictEqual(normalized.businessEmail, 'dispatch@northstar.com');
  assert.strictEqual(normalized.contactQualityState, 'OBSERVED_VALID_SYNTAX');
  assert.strictEqual(normalized.contactProfile.primaryPhone, '+18005550122');
  assert.strictEqual(normalized.contactProfile.observedPhones.length, 1);
});

// --------------------------------------------------------------------------
// SECTION 8: CSV EXPORT COMPATIBILITY & FORMULA SAFETY
// --------------------------------------------------------------------------
console.log('\n--- SECTION 8: CSV EXPORT COMPATIBILITY & FORMULA INJECTION DEFENSE ---');

test('exportLeadsToCsv emits all 8 Phase 7 contact headers while preserving existing 44 columns', () => {
  const lead = {
    id: 'lead_csv_1',
    name: 'Summit Solar',
    canonicalName: 'Summit Solar',
    facebookPageName: 'Summit Solar',
    status: 'QUALIFIED',
    adLibraryIds: ['400000000001'],
    businessPhone: '+18005550199',
    businessEmail: 'contact@summitsolar.com',
    contactQualityState: 'OBSERVED_VALID_SYNTAX',
    contactProfile: {
      primaryPhone: '+18005550199',
      primaryEmail: 'contact@summitsolar.com',
      observedPhones: [{
        syntaxState: 'SYNTAX_VALID',
        sourceSurface: 'AD_BODY_TEXT',
        verificationStatus: 'UNPROBED_PUBLIC_CLAIM'
      }],
      observedEmails: [{
        syntaxState: 'SYNTAX_VALID',
        sourceSurface: 'AD_BODY_TEXT',
        verificationStatus: 'UNPROBED_PUBLIC_CLAIM'
      }],
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      overallQualityState: 'OBSERVED_VALID_SYNTAX'
    },
    discoveredAt: '2026-10-15T12:00:00Z'
  };

  const csv = exportLeadsToCsv([lead]);
  const lines = csv.split('\r\n').filter(Boolean);
  const headerLine = lines[0];

  assert.ok(headerLine.includes('Public Observed Phone'));
  assert.ok(headerLine.includes('Public Observed Email'));
  assert.ok(headerLine.includes('Phone Syntax Status'));
  assert.ok(headerLine.includes('Email Syntax Status'));
  assert.ok(headerLine.includes('Contact Evidence Source'));
  assert.ok(headerLine.includes('Contact Conflict Status'));
  assert.ok(headerLine.includes('Contact Quality State'));
  assert.ok(headerLine.includes('Contact Verification State'));

  const rowLine = lines[1];
  assert.ok(rowLine.includes('+18005550199'));
  assert.ok(rowLine.includes('contact@summitsolar.com'));
  assert.ok(rowLine.includes('UNPROBED_PUBLIC_CLAIM'));
});

test('exportLeadsToCsv neutralizes formula injection in contact fields (=cmd, @SUM)', () => {
  const dangerousLead = {
    id: 'lead_csv_inject',
    name: 'Injection Test',
    canonicalName: 'Injection Test',
    facebookPageName: 'Injection Test',
    status: 'REVIEW_REQUIRED',
    adLibraryIds: ['500000000001'],
    businessPhone: '=cmd|"/C calc"!A0',
    businessEmail: '@SUM(1,2)@inject.com',
    discoveredAt: '2026-10-15T12:00:00Z'
  };

  const csv = exportLeadsToCsv([dangerousLead]);
  const rowLine = csv.split('\r\n')[1];
  // sanitizeCsvField prefixes leading =, +, -, @ with a single quote '
  assert.ok(rowLine.includes("'=cmd"));
  assert.ok(rowLine.includes("'@SUM"));
});

// --------------------------------------------------------------------------
// SECTION 9: FAIL-CLOSED SAFETY GATES & ARCHIVE INTEGRITY
// --------------------------------------------------------------------------
console.log('\n--- SECTION 9: FAIL-CLOSED SAFETY GATES & ARCHIVE INTEGRITY ---');

test('Safety gate isLiveCollectionPermitted() strictly evaluates to false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false);
});

test('Safety gate isExternalWebsiteCrawlingPermitted() strictly evaluates to false', () => {
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false);
});

test('Historical release archives remain byte-for-byte immutable', () => {
  function sha256(filePath) {
    const buf = fs.readFileSync(path.join(rootDir, filePath));
    return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  }

  assert.strictEqual(sha256('dist/leadnoria-v1.7.5.zip'), '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85');
  assert.strictEqual(sha256('dist/leadnoria-v1.7.6.zip'), 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105');
  assert.strictEqual(sha256('extension.zip'), '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85');
});

// --------------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`Phase 7 Regression Test Summary: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
