/**
 * LeadNoria — Authoritative Lead Qualification Gate & Explainability Engine
 * Phase 0.6: Qualification Engine & Lead Scoring Hardening
 *
 * Implements single source of truth for qualification eligibility across:
 * - Candidate ingestion & batch processing
 * - Entity merging & state updates
 * - Persistent storage normalization
 * - Lead export policy and CSV/JSON serializers
 *
 * INVARIANTS:
 * 1. Concept separation: Relevance != Geography != Score != Confidence != Qualification != Destination.
 * 2. Fail-closed: Missing, unassessed, or uncertain evidence CANNOT grant qualification.
 * 3. Strict-local default: FOREIGN_VERIFIED, LOCATION_UNKNOWN, and LOCAL_PROBABLE (unless explicitly allowed) fail the geographic gate.
 * 4. High scores, high confidence, or verified websites NEVER override failed relevance, geography, or CTA/destination requirements.
 * 5. Full explainability: Stable reason codes and human-readable audit reasons returned for all decisions.
 */

import type {
  ExtensionLead,
  GeographicClassification,
  RelevanceDecision,
  CtaType,
  DestinationType
} from './types.ts';
import type { ResearchIntent } from './relevanceEngine.ts';

export type WebsiteRequirementMode =
  | 'WITH_WEBSITE'
  | 'WITHOUT_WEBSITE'
  | 'WITHOUT_OBSERVED_WEBSITE'
  | 'BOTH'
  | 'ANY'
  | 'WITH'
  | 'WITHOUT';

export interface LeadQualificationGateResult {
  isQualified: boolean;
  status: 'QUALIFIED' | 'REVIEW_REQUIRED';
  canonicalOutcome: 'QUALIFIED' | 'REJECTED' | 'REVIEW';
  failedGates: string[];
  passedGates: string[];
  reasons: string[];
}

export interface QualificationCriteriaInput {
  strictLocalMode?: boolean;
  allowProbableLocal?: boolean;
  requiredCtaTypes?: CtaType[];
  requiredDestinationTypes?: DestinationType[];
  requireWebsiteFound?: boolean;
  websiteRequirement?: WebsiteRequirementMode;
}

/**
 * Evaluates candidate data integrity, niche relevance, geographic origin,
 * call-to-action requirements, destination requirements, and website requirements against configured criteria.
 */
export function evaluateLeadQualificationGates(
  lead: Partial<ExtensionLead>,
  criteria?: QualificationCriteriaInput | ResearchIntent
): LeadQualificationGateResult {
  const failedGates: string[] = [];
  const passedGates: string[] = [];
  const reasons: string[] = [];

  // Gate 1: Candidate Data Integrity
  const cleanName = (lead.name || lead.canonicalName || '').trim();
  if (!cleanName) {
    failedGates.push('GATE_INTEGRITY_NAME');
    reasons.push('Candidate lacks valid business or advertiser name.');
  } else if (Array.isArray(lead.adLibraryIds) && lead.adLibraryIds.length === 0) {
    failedGates.push('GATE_INTEGRITY_ADS');
    reasons.push('Candidate has zero verified ad library identifiers.');
  } else {
    passedGates.push('GATE_INTEGRITY');
  }

  // Gate 2: Niche Semantic Relevance
  const relDecision = lead.relevanceDecision;
  if (relDecision === 'RELEVANT') {
    passedGates.push('GATE_RELEVANCE');
  } else {
    failedGates.push('GATE_RELEVANCE');
    if (!relDecision || relDecision === 'UNASSESSED') {
      reasons.push('Niche semantic relevance is unassessed (UNASSESSED).');
    } else if (relDecision === 'UNCERTAIN') {
      reasons.push('Niche semantic relevance is ambiguous or uncertain (UNCERTAIN).');
    } else if (relDecision === 'NOT_RELEVANT') {
      reasons.push('Candidate was rejected as not relevant to target niche (NOT_RELEVANT).');
    }
  }

  // Gate 3: Geographic Origin Qualification
  const geo = lead.geographicClassification;
  const isStrictLocal = criteria?.strictLocalMode !== false; // strict local by default
  const allowProbable = criteria?.allowProbableLocal === true;

  if (geo === 'LOCAL_VERIFIED') {
    passedGates.push('GATE_GEOGRAPHY');
  } else if (geo === 'LOCAL_PROBABLE') {
    if (allowProbable || !isStrictLocal) {
      passedGates.push('GATE_GEOGRAPHY');
    } else {
      failedGates.push('GATE_GEOGRAPHY');
      reasons.push('Geographic location is probable (LOCAL_PROBABLE), but strict-local policy requires verified proof.');
    }
  } else if (geo === 'FOREIGN_VERIFIED') {
    failedGates.push('GATE_GEOGRAPHY');
    reasons.push('Business is verified as foreign entity (FOREIGN_VERIFIED).');
  } else {
    failedGates.push('GATE_GEOGRAPHY');
    reasons.push('Physical business location is unverified or unknown (LOCATION_UNKNOWN).');
  }

  // Gate 4: Required Call-to-Action (CTA) Types
  if (criteria?.requiredCtaTypes && criteria.requiredCtaTypes.length > 0) {
    const observedCtas = lead.observedCtaTypes || (lead.primaryCtaType ? [lead.primaryCtaType] : []);
    const matchesCta = observedCtas.some(c => criteria.requiredCtaTypes!.includes(c));
    if (matchesCta) {
      passedGates.push('GATE_CTA');
    } else {
      failedGates.push('GATE_CTA');
      reasons.push(`Observed CTAs (${observedCtas.join(', ') || 'none'}) do not satisfy required CTA types: ${criteria.requiredCtaTypes.join(', ')}.`);
    }
  }

  // Gate 5: Required Destination Types
  if (criteria?.requiredDestinationTypes && criteria.requiredDestinationTypes.length > 0) {
    const effectiveReqDests = criteria.requiredDestinationTypes.map(d => (d === ('APP_STORE' as any) ? 'APP' : d));
    const observedDests = lead.observedDestinationTypes || (lead.primaryDestinationType ? [lead.primaryDestinationType] : []);
    const matchesDest = observedDests.some(d => effectiveReqDests.includes(d));
    if (matchesDest) {
      passedGates.push('GATE_DESTINATION');
    } else {
      failedGates.push('GATE_DESTINATION');
      reasons.push(`Observed destinations (${observedDests.join(', ') || 'none'}) do not satisfy required destination types: ${criteria.requiredDestinationTypes.join(', ')}.`);
    }
  }

  // Gate 6: Website Requirement Gate
  const reqWebMode = criteria?.websiteRequirement;
  const isWebsiteDestination = lead.primaryDestinationType === 'EXTERNAL_WEBSITE' ||
    (lead.observedDestinationTypes && lead.observedDestinationTypes.includes('EXTERNAL_WEBSITE'));

  if (reqWebMode === 'WITH_WEBSITE' || reqWebMode === 'WITH') {
    if (lead.websiteState !== 'found' || (!lead.businessWebsiteUrl && !lead.destinationUrl && !lead.destinationDomain)) {
      failedGates.push('GATE_WEBSITE');
      reasons.push('Configured website requirement (WITH_WEBSITE) failed: external website destination is unobserved, missing, or unverified.');
    } else {
      passedGates.push('GATE_WEBSITE');
    }
  } else if (reqWebMode === 'WITHOUT_OBSERVED_WEBSITE') {
    if (lead.websiteState === 'found') {
      failedGates.push('GATE_WEBSITE');
      reasons.push('An external website was observed in the ad or public business Page.');
    } else {
      passedGates.push('GATE_WEBSITE');
      reasons.push('No external website was observed; the business may still have one.');
    }
  } else if (reqWebMode === 'WITHOUT_WEBSITE' || reqWebMode === 'WITHOUT') {
    if (lead.websiteState === 'found' || Boolean(lead.destinationUrl || lead.destinationDomain)) {
      failedGates.push('GATE_WEBSITE');
      reasons.push('Configured website requirement (WITHOUT_WEBSITE) failed: business has an observed website destination.');
    } else if (lead.websiteState === 'not_found' && lead.primaryDestinationType === 'NO_VISIBLE_DESTINATION') {
      passedGates.push('GATE_WEBSITE');
    } else {
      failedGates.push('GATE_WEBSITE');
      reasons.push('Configured website requirement (WITHOUT_WEBSITE) requires explicit evidence of absence; missing ad destination URL alone does not prove no website.');
    }
  } else {
    // Default / BOTH / ANY mode:
    const requireWeb = criteria?.requireWebsiteFound ?? isWebsiteDestination;
    if (requireWeb && lead.websiteState !== 'found') {
      failedGates.push('GATE_WEBSITE');
      reasons.push('External website was required or classified as primary destination, but valid destination URL is missing.');
    } else {
      passedGates.push('GATE_WEBSITE');
    }
  }

  const isQualified = failedGates.length === 0;

  // Determine canonical outcome: QUALIFIED, REJECTED, or REVIEW
  let canonicalOutcome: 'QUALIFIED' | 'REJECTED' | 'REVIEW';
  if (isQualified) {
    canonicalOutcome = 'QUALIFIED';
  } else {
    const isHardRejection =
      lead.relevanceDecision === 'NOT_RELEVANT' ||
      geo === 'FOREIGN_VERIFIED' ||
      ((reqWebMode === 'WITHOUT_WEBSITE' || reqWebMode === 'WITHOUT') && (lead.websiteState === 'found' || Boolean(lead.destinationUrl || lead.destinationDomain)));
    canonicalOutcome = isHardRejection ? 'REJECTED' : 'REVIEW';
  }

  return {
    isQualified,
    status: isQualified ? 'QUALIFIED' : 'REVIEW_REQUIRED',
    canonicalOutcome,
    failedGates,
    passedGates,
    reasons
  };
}
