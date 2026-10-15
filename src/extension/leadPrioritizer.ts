/**
 * LeadNoria — Phase 8: Lead Scoring & Prioritization Engine
 *
 * Implements a deterministic, explainable lead prioritization system integrating:
 * 1. Geographic Eligibility (actual business location evidence vs target market)
 * 2. Niche Semantic Relevance (evidence match, intent keywords, confidence)
 * 3. Ad Evidence Quality (verified library IDs, active status, creative copy, anti-inflation)
 * 4. CTA / Destination Relevance (alignment with configured research requirements)
 * 5. Contact Data Quality (public observed phones/emails, syntax state, provenance, conflict safety)
 * 6. Identity & Evidence Consistency (Page ID resolution, clean domain, cross-ad consistency)
 *
 * NON-NEGOTIABLE INVARIANTS:
 * 1. Score is a prioritization aid, NOT a qualification decision.
 * 2. Score does NOT equal confidence, verification, or reachability.
 * 3. A high score NEVER overrides geographic or qualification safeguards.
 * 4. Unknown or missing evidence MUST NOT silently receive positive score as if verified.
 * 5. Do not reward a record merely for having more ads or duplicated evidence (anti-inflation).
 * 6. Conflicting observations remain visible with explicit penalties and must not be silently resolved.
 * 7. Contact syntax validity is a data-quality signal only; reachability/ownership is never claimed.
 * 8. FOREIGN_VERIFIED businesses receive 0 geographic points and cannot qualify for strict local workflows.
 * 9. targetCountryCode cannot substitute for actual businessCountryCode.
 * 10. Canonical qualification outcomes (QUALIFIED, REJECTED, REVIEW) remain solely governed by qualification gates.
 */

import type {
  ExtensionLead,
  GeographicClassification,
  RelevanceDecision,
  RelevanceConfidence,
  CtaType,
  DestinationType,
  ContactEntityProfile
} from './types.ts';
import type { QualificationCriteriaInput } from './qualificationGate.ts';
import type { ResearchIntent } from './relevanceEngine.ts';

export const SCORING_MODEL_VERSION = 'leadnoria-scoring-v1';

export type PrioritizationTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

export interface ComponentScoreContribution {
  name: string;
  key: 'geography' | 'relevance' | 'adEvidence' | 'ctaDestination' | 'contactQuality' | 'identityConsistency';
  score: number;
  maxScore: number;
  weight: number;
  status: 'ASSESSED' | 'MISSING' | 'WARNING' | 'PENALIZED';
  reason: string;
  evidence: string[];
}

export interface LeadScoreBreakdown {
  overallScore: number; // 0 to 100
  normalizedScore: number; // 0.00 to 1.00
  prioritizationTier: PrioritizationTier;
  scoreConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  modelVersion: string;
  components: {
    geography: ComponentScoreContribution;
    relevance: ComponentScoreContribution;
    adEvidence: ComponentScoreContribution;
    ctaDestination: ComponentScoreContribution;
    contactQuality: ComponentScoreContribution;
    identityConsistency: ComponentScoreContribution;
  };
  missingComponents: string[];
  penalties: string[];
  warnings: string[];
  explanation: string;
  qualificationDisclaimer: string;
  calculatedAt: string;
}

export interface LeadPrioritizationResult {
  score: number;
  normalizedScore: number;
  tier: PrioritizationTier;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  breakdown: LeadScoreBreakdown;
  explanation: string;
}

/**
 * Deterministically calculates explainable lead prioritization score across 6 evidence dimensions.
 */
export function calculateLeadScore(
  lead: Partial<ExtensionLead>,
  criteria?: QualificationCriteriaInput | ResearchIntent
): LeadPrioritizationResult {
  const missingComponents: string[] = [];
  const penalties: string[] = [];
  const warnings: string[] = [];

  // ==========================================
  // Dimension 1: Geographic Eligibility (Weight: 25)
  // ==========================================
  let geoScore = 0;
  let geoStatus: ComponentScoreContribution['status'] = 'MISSING';
  let geoReason = '';
  const geoEvidence: string[] = [];

  const geoClassification: GeographicClassification = lead.geographicClassification || 'LOCATION_UNKNOWN';
  const targetCountry = (criteria as any)?.targetCountryCode || lead.targetCountryCode || lead.locationCode;
  const businessCountry = lead.businessCountryCode;

  if (Array.isArray(lead.businessLocationEvidence)) {
    geoEvidence.push(...lead.businessLocationEvidence);
  }

  if (geoClassification === 'LOCAL_VERIFIED') {
    if (businessCountry && targetCountry && businessCountry.toUpperCase() !== targetCountry.toUpperCase()) {
      // Contradiction: verified business location is outside the requested target country
      geoScore = 0;
      geoStatus = 'PENALIZED';
      geoReason = `Verified business location (${businessCountry}) does not match target country (${targetCountry}).`;
      penalties.push(`GEOGRAPHIC_MISMATCH: ${geoReason}`);
    } else {
      geoScore = 25;
      geoStatus = 'ASSESSED';
      geoReason = `Business location verified in target market (${businessCountry || targetCountry || 'local'}).`;
      if (geoEvidence.length === 0) {
        geoEvidence.push('Deterministic local business evidence established.');
      }
    }
  } else if (geoClassification === 'LOCAL_PROBABLE') {
    geoScore = 12;
    geoStatus = 'WARNING';
    geoReason = 'Business location is probable but lacks deterministic proof. Requires manual verification.';
    warnings.push('GEOGRAPHIC_PROBABLE_REVIEW: Probable location requires review under strict local policy.');
  } else if (geoClassification === 'FOREIGN_VERIFIED') {
    geoScore = 0;
    geoStatus = 'PENALIZED';
    geoReason = `Business verified as foreign entity (${businessCountry || 'foreign'}) operating outside target market. Strict 0 points.`;
    penalties.push(`FOREIGN_VERIFIED_OUT_OF_MARKET: ${geoReason}`);
  } else {
    // LOCATION_UNKNOWN
    geoScore = 0;
    geoStatus = 'MISSING';
    geoReason = 'Physical business location is unobserved or unknown. No geographic points awarded.';
    missingComponents.push('Geographic location evidence (LOCATION_UNKNOWN)');
  }

  const geographyComponent: ComponentScoreContribution = {
    name: 'Geographic Eligibility',
    key: 'geography',
    score: geoScore,
    maxScore: 25,
    weight: 25,
    status: geoStatus,
    reason: geoReason,
    evidence: geoEvidence
  };

  // ==========================================
  // Dimension 2: Niche Semantic Relevance (Weight: 25)
  // ==========================================
  let relScore = 0;
  let relStatus: ComponentScoreContribution['status'] = 'MISSING';
  let relReason = '';
  const relEvidence: string[] = [];

  const relDecision: RelevanceDecision = lead.relevanceDecision || 'UNASSESSED';
  const relConfidence = lead.relevanceConfidence;

  if (Array.isArray(lead.relevanceMatchedTerms)) {
    relEvidence.push(...lead.relevanceMatchedTerms);
  }

  if (relDecision === 'RELEVANT') {
    if (relConfidence === 'HIGH') {
      relScore = 25;
    } else if (relConfidence === 'MEDIUM') {
      relScore = 20;
    } else {
      relScore = 15;
    }
    relStatus = 'ASSESSED';
    relReason = `Candidate classified as RELEVANT with ${relConfidence} confidence.`;
  } else if (relDecision === 'UNCERTAIN') {
    relScore = 8;
    relStatus = 'WARNING';
    relReason = 'Niche semantic relevance is ambiguous or borderline. Evidence is inconclusive.';
    warnings.push('RELEVANCE_UNCERTAIN_REVIEW: Candidate requires manual relevance review.');
  } else if (relDecision === 'NOT_RELEVANT') {
    relScore = 0;
    relStatus = 'PENALIZED';
    relReason = 'Candidate classified as NOT_RELEVANT to target niche. Strict 0 points.';
    penalties.push('NOT_RELEVANT_TO_NICHE: Candidate failed niche semantic relevance.');
  } else {
    // UNASSESSED
    relScore = 0;
    relStatus = 'MISSING';
    relReason = 'Niche relevance is unassessed. No relevance points awarded.';
    missingComponents.push('Niche semantic relevance assessment (UNASSESSED)');
  }

  const relevanceComponent: ComponentScoreContribution = {
    name: 'Niche Semantic Relevance',
    key: 'relevance',
    score: relScore,
    maxScore: 25,
    weight: 25,
    status: relStatus,
    reason: relReason,
    evidence: relEvidence
  };

  // ==========================================
  // Dimension 3: Ad Evidence Quality (Weight: 15)
  // ==========================================
  // Anti-inflation: reward unique verified ads up to a cap of 7 pts
  // 1 ad = 4 pts, 2 ads = 6 pts, 3+ ads = 7 pts
  const adIds = Array.isArray(lead.adLibraryIds)
    ? Array.from(new Set(lead.adLibraryIds.filter(id => typeof id === 'string' && /^[0-9]{5,25}$/.test(id))))
    : [];

  let adPoints = 0;
  if (adIds.length >= 3) {
    adPoints = 7;
  } else if (adIds.length === 2) {
    adPoints = 6;
  } else if (adIds.length === 1) {
    adPoints = 4;
  }

  // Active status points (4 pts)
  const hasActiveAds = (lead.activeAdCount && lead.activeAdCount > 0) ||
    (Array.isArray(lead.activeAdLibraryIds) && lead.activeAdLibraryIds.length > 0);
  const activePoints = hasActiveAds ? 4 : 0;

  // Creative copy observed (4 pts)
  const hasCopy = Boolean(lead.sampleCopy && lead.sampleCopy.trim().length > 15);
  const copyPoints = hasCopy ? 4 : 0;

  const adEvidenceTotal = adPoints + activePoints + copyPoints;
  const adEvidenceScore = Math.min(15, adEvidenceTotal);
  let adStatus: ComponentScoreContribution['status'] = 'ASSESSED';
  let adReason = `Observed ${adIds.length} verified ad(s) (${hasActiveAds ? 'active' : 'inactive'}), creative copy ${hasCopy ? 'present' : 'absent'}.`;

  if (adIds.length === 0) {
    adStatus = 'MISSING';
    adReason = 'Zero verified Meta Ad Library identifiers observed. No ad evidence points.';
    missingComponents.push('Verified Meta Ad Library identifiers');
  }

  const adEvidenceComponent: ComponentScoreContribution = {
    name: 'Ad Evidence Quality',
    key: 'adEvidence',
    score: adEvidenceScore,
    maxScore: 15,
    weight: 15,
    status: adStatus,
    reason: adReason,
    evidence: adIds.slice(0, 3).map(id => `Ad Library ID: ${id}`)
  };

  // ==========================================
  // Dimension 4: CTA / Destination Relevance (Weight: 15)
  // ==========================================
  let ctaDestScore = 0;
  let ctaDestStatus: ComponentScoreContribution['status'] = 'ASSESSED';
  let ctaDestReason = '';
  const ctaDestEvidence: string[] = [];

  const reqCtas = (criteria as any)?.requiredCtaTypes || [];
  const reqDests = (criteria as any)?.requiredDestinationTypes || [];
  const obsCtas: CtaType[] = lead.observedCtaTypes || (lead.primaryCtaType ? [lead.primaryCtaType] : []);
  const obsDests: DestinationType[] = lead.observedDestinationTypes || (lead.primaryDestinationType ? [lead.primaryDestinationType] : []);

  if (lead.primaryCtaType) ctaDestEvidence.push(`Primary CTA: ${lead.primaryCtaType}`);
  if (lead.primaryDestinationType) ctaDestEvidence.push(`Primary Destination: ${lead.primaryDestinationType}`);

  if (reqCtas.length > 0 || reqDests.length > 0) {
    const effectiveReqDests = reqDests.map((d: any) => (d === 'APP_STORE' ? 'APP' : d));
    const ctaMatches = reqCtas.length === 0 || obsCtas.some(c => reqCtas.includes(c));
    const destMatches = reqDests.length === 0 || obsDests.some(d => effectiveReqDests.includes(d));

    if (ctaMatches && destMatches) {
      ctaDestScore = 15;
      ctaDestStatus = 'ASSESSED';
      ctaDestReason = `Observed CTA (${obsCtas.join(', ') || 'none'}) and destination (${obsDests.join(', ') || 'none'}) satisfy research requirements.`;
    } else if (ctaMatches || destMatches) {
      ctaDestScore = 8;
      ctaDestStatus = 'WARNING';
      ctaDestReason = `Partially matches research requirements (CTA match: ${ctaMatches}, Destination match: ${destMatches}).`;
      warnings.push(`PARTIAL_REQUIREMENT_MATCH: ${ctaDestReason}`);
    } else {
      ctaDestScore = 0;
      ctaDestStatus = 'PENALIZED';
      ctaDestReason = `Observed CTA and destination do not satisfy configured requirements (Required CTAs: ${reqCtas.join(', ')}, Destinations: ${reqDests.join(', ')}).`;
      penalties.push(`CTA_DESTINATION_MISMATCH: ${ctaDestReason}`);
    }
  } else {
    // Default mode: evaluate commercial clarity
    const isCommercialCta = ['CALL_NOW', 'BOOK_TRAVEL', 'SEND_MESSAGE', 'SHOP_NOW', 'ORDER_NOW', 'GET_QUOTE', 'CONTACT_US', 'SIGN_UP'].includes(lead.primaryCtaType as any);
    const ctaPoints = isCommercialCta ? 8 : (lead.primaryCtaType && lead.primaryCtaType !== 'UNKNOWN' ? 5 : 0);

    const isValidDest = ['EXTERNAL_WEBSITE', 'MESSAGING', 'INSTANT_FORM', 'APP'].includes(lead.primaryDestinationType as any);
    const destPoints = isValidDest ? 7 : (lead.primaryDestinationType && lead.primaryDestinationType !== 'NO_VISIBLE_DESTINATION' && lead.primaryDestinationType !== 'UNKNOWN' ? 4 : 0);

    ctaDestScore = ctaPoints + destPoints;
    if (ctaDestScore === 0) {
      ctaDestStatus = 'MISSING';
      ctaDestReason = 'Neither actionable CTA nor visible commercial destination observed.';
      missingComponents.push('Actionable CTA / commercial destination');
    } else {
      ctaDestStatus = 'ASSESSED';
      ctaDestReason = `Observed CTA: ${lead.primaryCtaType || 'UNKNOWN'} (${ctaPoints} pts), Destination: ${lead.primaryDestinationType || 'UNKNOWN'} (${destPoints} pts).`;
    }
  }

  const ctaDestinationComponent: ComponentScoreContribution = {
    name: 'CTA / Destination Relevance',
    key: 'ctaDestination',
    score: ctaDestScore,
    maxScore: 15,
    weight: 15,
    status: ctaDestStatus,
    reason: ctaDestReason,
    evidence: ctaDestEvidence
  };

  // ==========================================
  // Dimension 5: Contact Data Quality (Weight: 10)
  // ==========================================
  let contactScore = 0;
  let phonePts = 0;
  let emailPts = 0;
  let contactConflictDeduction = 0;
  const contactEvidence: string[] = [];

  const profile: ContactEntityProfile | undefined = lead.contactProfile;
  const hasPhone = Boolean(lead.businessPhone || (lead.phones && lead.phones.length > 0) || (profile && profile.primaryPhone));
  const hasEmail = Boolean(lead.businessEmail || (lead.emails && lead.emails.length > 0) || (profile && profile.primaryEmail));

  // Phone points
  const phoneObs = profile?.observedPhones?.[0];
  if (phoneObs?.syntaxState === 'SYNTAX_VALID' || (!phoneObs && hasPhone)) {
    phonePts = 5;
    contactEvidence.push(`Public phone observed with valid syntax (${phoneObs?.normalizedValue || lead.businessPhone || 'observed'}).`);
  } else if (phoneObs?.syntaxState === 'AMBIGUOUS') {
    phonePts = 2;
    contactEvidence.push('Public phone observed with ambiguous national formatting (no international dial code).');
  }

  // Email points
  const emailObs = profile?.observedEmails?.[0];
  if (emailObs?.syntaxState === 'SYNTAX_VALID' || (!emailObs && hasEmail)) {
    emailPts = 5;
    contactEvidence.push(`Public email observed with valid syntax (${emailObs?.normalizedValue || lead.businessEmail || 'observed'}).`);
  } else if (emailObs?.syntaxState === 'AMBIGUOUS') {
    emailPts = 2;
    contactEvidence.push('Public email observed with ambiguous format.');
  }

  // Conflict penalty (-4 pts)
  const hasConflict = profile?.phoneConflict || profile?.emailConflict ||
    profile?.phoneConflictState === 'CONFLICT_DETECTED' || profile?.emailConflictState === 'CONFLICT_DETECTED';

  if (hasConflict) {
    contactConflictDeduction = 4;
    warnings.push('CONTACT_CONFLICT_DETECTED: Conflicting phone numbers or email addresses observed across ads for this advertiser.');
  }

  contactScore = Math.max(0, phonePts + emailPts - contactConflictDeduction);
  let contactStatus: ComponentScoreContribution['status'] = 'ASSESSED';
  let contactReason = `Contact syntax evaluation (+${phonePts} phone, +${emailPts} email${hasConflict ? ', -4 conflict deduction' : ''}). Format quality only; reachability is unverified.`;

  if (phonePts === 0 && emailPts === 0) {
    contactStatus = 'MISSING';
    contactReason = 'No public business phone or email observed in permitted ad copy.';
    missingComponents.push('Public business contact information');
  } else if (hasConflict) {
    contactStatus = 'WARNING';
  }

  const contactQualityComponent: ComponentScoreContribution = {
    name: 'Contact Data Quality',
    key: 'contactQuality',
    score: contactScore,
    maxScore: 10,
    weight: 10,
    status: contactStatus,
    reason: contactReason,
    evidence: contactEvidence
  };

  // ==========================================
  // Dimension 6: Identity & Evidence Consistency (Weight: 10)
  // ==========================================
  let identityScore = 0;
  const identityEvidence: string[] = [];

  const hasPageId = Boolean(lead.canonicalPageId || lead.facebookPageUrl);
  const pagePts = hasPageId ? 5 : 0;
  if (hasPageId) {
    identityEvidence.push(`Canonical Facebook Page resolved (${lead.canonicalPageId || lead.canonicalPageSlug || 'URL'}).`);
  }

  const hasCleanDomain = Boolean(
    lead.destinationDomain &&
    !['facebook.com', 'instagram.com', 'whatsapp.com', 'm.me'].includes(lead.destinationDomain.toLowerCase())
  );
  const domainPts = hasCleanDomain ? 5 : 0;
  if (hasCleanDomain) {
    identityEvidence.push(`Clean destination domain resolved (${lead.destinationDomain}).`);
  }

  identityScore = pagePts + domainPts;
  let identityStatus: ComponentScoreContribution['status'] = 'ASSESSED';
  let identityReason = `Identity established via Page identity (+${pagePts} pts) and destination domain (+${domainPts} pts).`;

  if (identityScore === 0) {
    identityStatus = 'MISSING';
    identityReason = 'Neither verified Facebook Page ID nor clean destination domain observed.';
    missingComponents.push('Corroborating Facebook Page ID or destination domain');
  }

  const identityConsistencyComponent: ComponentScoreContribution = {
    name: 'Identity & Evidence Consistency',
    key: 'identityConsistency',
    score: identityScore,
    maxScore: 10,
    weight: 10,
    status: identityStatus,
    reason: identityReason,
    evidence: identityEvidence
  };

  // ==========================================
  // Overall Score & Normalization
  // ==========================================
  const rawSum = geoScore + relScore + adEvidenceScore + ctaDestScore + contactScore + identityScore;
  const overallScore = Math.max(0, Math.min(100, Math.round(rawSum)));
  const normalizedScore = +(overallScore / 100).toFixed(2);

  // Prioritization Tier
  let tier: PrioritizationTier;
  if (overallScore >= 75) {
    tier = 'HIGH';
  } else if (overallScore >= 50) {
    tier = 'MEDIUM';
  } else if (overallScore >= 25) {
    tier = 'LOW';
  } else {
    tier = 'MINIMAL';
  }

  // Score Confidence
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  if (geoClassification === 'LOCAL_VERIFIED' && relDecision === 'RELEVANT' && relConfidence === 'HIGH') {
    confidence = 'HIGH';
  } else if (
    (geoClassification === 'LOCAL_VERIFIED' || geoClassification === 'LOCAL_PROBABLE') &&
    relDecision === 'RELEVANT'
  ) {
    confidence = 'MEDIUM';
  } else if (geoClassification === 'LOCATION_UNKNOWN' || relDecision === 'UNCERTAIN') {
    confidence = 'LOW';
  } else {
    confidence = 'NONE';
  }

  // Explanation
  const explanationParts: string[] = [
    `Lead priority score: ${overallScore}/100 (${tier} priority tier, ${confidence} score confidence).`
  ];
  if (penalties.length > 0) {
    explanationParts.push(`Penalties applied: ${penalties.join('; ')}.`);
  }
  if (warnings.length > 0) {
    explanationParts.push(`Warnings: ${warnings.join('; ')}.`);
  }
  if (missingComponents.length > 0) {
    explanationParts.push(`Missing components: ${missingComponents.join('; ')}.`);
  }
  const explanation = explanationParts.join(' ');

  const qualificationDisclaimer =
    'Scoring is a deterministic prioritization aid and does not constitute lead qualification or verified reachability.';

  const breakdown: LeadScoreBreakdown = {
    overallScore,
    normalizedScore,
    prioritizationTier: tier,
    scoreConfidence: confidence,
    modelVersion: SCORING_MODEL_VERSION,
    components: {
      geography: geographyComponent,
      relevance: relevanceComponent,
      adEvidence: adEvidenceComponent,
      ctaDestination: ctaDestinationComponent,
      contactQuality: contactQualityComponent,
      identityConsistency: identityConsistencyComponent
    },
    missingComponents,
    penalties,
    warnings,
    explanation,
    qualificationDisclaimer,
    calculatedAt: new Date().toISOString()
  };

  return {
    score: overallScore,
    normalizedScore,
    tier,
    confidence,
    breakdown,
    explanation
  };
}
