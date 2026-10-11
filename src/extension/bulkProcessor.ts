/**
 * Bulk Processing Engine for LeadNoria (Phase 2)
 *
 * Implements bounded extraction batch processing:
 * 1. Filter out duplicate ads via seenAdLibraryIds
 * 2. Resolve stable entity identity (canonical name, page ID, domain)
 * 3. Evaluate new entities against Strict Relevance Gate v2
 * 4. Entity-level anti-inflation (1 advertiser with 100 ads = 1 entity)
 * 5. Global 5,000 unique relevant leads safety cap
 * 6. Return batch persistence payload and updated truthful counters
 */

import { MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH } from './types.ts';
import type {
  ScrapedAdCandidate,
  ExtensionLead,
  RunCounters,
  StructuredEvidence,
  AdLevelEvidence
} from './types.ts';
import { LeadRelevanceEngine } from './relevanceEngine.ts';
import type { ResearchIntent } from './relevanceEngine.ts';
import { evaluateGeographicOrigin } from './geographicClassifier.ts';
import { classifyCta, classifyDestination, aggregateAdEvidence } from './destinationClassifier.ts';
import {
  evaluateStrictRelevanceV3,
  recordCandidateEvidenceInProfile,
  createEntityEvidenceProfile,
  buildUncertainRecord
} from './evidenceWaterfall.ts';
import {
  EntityResolutionIndex,
  evaluateEntityMerge,
  mergeCandidateIntoEntity,
  normalizeAdvertiserName as normAdvName,
  normalizeFacebookPage,
  normalizeDestinationDomain
} from './entityResolver.ts';
import { extractCreativeSignalsFromCandidate, aggregateCreativeSignals } from './creativeSignals.ts';
import { classifyUncertainCandidate } from './uncertainQueue.ts';
import { checkAdvertiserExpansionEligibility } from './advertiserExpander.ts';
import { evaluateLeadQualificationGates } from './qualificationGate.ts';
import type { UncertainEntityRecord } from './types.ts';

export interface BatchProcessOptions {
  runId: string;
  countryCode: string;
  locationName: string;
  currentKeyword: string;
  intent?: ResearchIntent;
  effectiveCeiling: number; // Internal safety ceiling (up to 5,000)
  entityIndex?: EntityResolutionIndex;
  existingUncertainMap?: Map<string, UncertainEntityRecord>;
  alreadyExpandedEntityIds?: Set<string>;
  seenRejectedEntityKeys?: Set<string>;
  seenUncertainEntityKeys?: Set<string>;
}

export interface BatchProcessResult {
  processedAds: ScrapedAdCandidate[];
  updatedEntities: ExtensionLead[];
  uncertainEntities: UncertainEntityRecord[];
  newEvidence: Array<{ canonicalKey: string; evidence: any }>;
  newAdIdsAdded: string[];
  newEntityKeysAdded: string[];
  counters: RunCounters;
  safetyLimitReached: boolean;
  newUniqueRelevantLeadsCount: number;
}

/**
 * Normalizes advertiser name to clean, canonical display form
 */
export function normalizeAdvertiserName(rawName: string): string {
  return normAdvName(rawName);
}

/**
 * Derives deterministic entity identity key
 */
export function getCanonicalEntityKey(pageName: string, fbPageId?: string): string {
  const clean = normalizeAdvertiserName(pageName).toLowerCase();
  if (fbPageId && fbPageId.length > 4) {
    return `fb_${fbPageId}`;
  }
  return `name_${clean.replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Processes a bounded batch of scraped ad candidates
 */
export async function processBatch(
  candidates: ScrapedAdCandidate[],
  existingEntitiesMap: Map<string, ExtensionLead>,
  seenAdLibraryIds: Set<string>,
  seenEntityKeys: Set<string>,
  currentCounters: RunCounters,
  options: BatchProcessOptions
): Promise<BatchProcessResult> {
  const {
    runId,
    countryCode,
    locationName,
    currentKeyword,
    intent,
    effectiveCeiling
  } = options;

  const processedAds: ScrapedAdCandidate[] = [];
  const updatedEntities: ExtensionLead[] = [];
  const uncertainEntities: UncertainEntityRecord[] = [];
  const existingUncertainMap = options.existingUncertainMap || new Map<string, UncertainEntityRecord>();
  const seenRejectedEntityKeys = options.seenRejectedEntityKeys || new Set<string>();
  const seenUncertainEntityKeys = options.seenUncertainEntityKeys || new Set<string>();
  const newEvidence: Array<{ canonicalKey: string; evidence: any }> = [];
  const newAdIdsAdded: string[] = [];
  const newEntityKeysAdded: string[] = [];

  const counters: RunCounters = {
    rawAds: currentCounters.rawAds,
    normalizedCandidates: currentCounters.normalizedCandidates,
    relevantCandidates: currentCounters.relevantCandidates,
    uncertainCandidates: currentCounters.uncertainCandidates,
    notRelevantCandidates: currentCounters.notRelevantCandidates,
    duplicatesRemoved: currentCounters.duplicatesRemoved,
    duplicateAdRecordsRemoved: currentCounters.duplicateAdRecordsRemoved ?? 0,
    entityMergesCount: currentCounters.entityMergesCount ?? 0,
    finalUniqueLeads: currentCounters.finalUniqueLeads,
    uniqueEntitiesObserved: currentCounters.uniqueEntitiesObserved ?? (existingEntitiesMap.size + seenRejectedEntityKeys.size + seenUncertainEntityKeys.size),
    relevantEntities: currentCounters.relevantEntities ?? existingEntitiesMap.size,
    uncertainEntities: currentCounters.uncertainEntities ?? seenUncertainEntityKeys.size,
    notRelevantEntities: currentCounters.notRelevantEntities ?? seenRejectedEntityKeys.size,
    keywordsCompleted: currentCounters.keywordsCompleted ?? 0,
    keywordsTotal: currentCounters.keywordsTotal ?? 1,
    finalUniqueRelevantLeads: currentCounters.finalUniqueRelevantLeads ?? currentCounters.finalUniqueLeads,
    reasonCodes: { ...(currentCounters.reasonCodes || {}) }
  };

  let safetyLimitReached = (counters.finalUniqueRelevantLeads || counters.finalUniqueLeads) >= effectiveCeiling;
  let newUniqueRelevantLeadsCount = 0;

  const entityIndex = options.entityIndex || new EntityResolutionIndex();
  // Ensure existing leads in existingEntitiesMap are indexed
  for (const [key, lead] of existingEntitiesMap.entries()) {
    entityIndex.indexEntity(key, lead);
  }

  for (const cand of candidates) {
    // 1. Duplicate ad protection
    if (seenAdLibraryIds.has(cand.libraryId)) {
      counters.duplicatesRemoved++;
      counters.duplicateAdRecordsRemoved = (counters.duplicateAdRecordsRemoved || 0) + 1;
      continue;
    }

    seenAdLibraryIds.add(cand.libraryId);
    newAdIdsAdded.push(cand.libraryId);
    counters.rawAds++;
    counters.normalizedCandidates++;
    processedAds.push(cand);

    // 2. Identity resolution check via deterministic multi-signal hierarchy
    const mergeDecision = evaluateEntityMerge(cand, existingEntitiesMap, entityIndex);

    if (mergeDecision.shouldMerge) {
        // Corroborated entity match! Merge into target entity
        const existingEntity = existingEntitiesMap.get(mergeDecision.targetKey);
        if (existingEntity) {
          counters.duplicatesRemoved++;
          counters.entityMergesCount = (counters.entityMergesCount || 0) + 1;
          mergeCandidateIntoEntity(existingEntity, cand, mergeDecision, currentKeyword, countryCode);

          // Aggregate creative signals into existing entity with anti-inflation
          const newSignals = extractCreativeSignalsFromCandidate(cand);
          existingEntity.creativeSignals = aggregateCreativeSignals([
            ...(existingEntity.creativeSignals || []),
            ...newSignals
          ]);

          // Re-evaluate geographic origin if new signals provide stronger corroboration
          const updatedGeo = evaluateGeographicOrigin({
            pageName: existingEntity.name,
            pageUrl: existingEntity.facebookPageUrl,
            destinationUrl: existingEntity.destinationUrl,
            destinationDomain: existingEntity.destinationDomain,
            bodyCopy: [existingEntity.sampleCopy, cand.bodyCopy].filter(Boolean).join(' '),
            ctaText: [existingEntity.sampleCta, cand.ctaText].filter(Boolean).join(' ')
          }, countryCode);

          const shouldUpdateGeo =
            !existingEntity.geographicClassification ||
            existingEntity.geographicClassification === 'LOCATION_UNKNOWN' ||
            updatedGeo.classification === 'FOREIGN_VERIFIED' ||
            (existingEntity.geographicClassification === 'LOCAL_PROBABLE' && updatedGeo.classification === 'LOCAL_VERIFIED') ||
            updatedGeo.reasonCode === 'CONFLICTING_LOCATION_EVIDENCE';

          if (shouldUpdateGeo) {
            existingEntity.targetCountryCode = updatedGeo.targetCountryCode;
            existingEntity.businessCountryCode = updatedGeo.businessCountryCode;
            existingEntity.geographicClassification = updatedGeo.classification;
            existingEntity.businessLocationConfidence = updatedGeo.confidence;
            existingEntity.businessLocationEvidence = Array.from(new Set([
              ...(existingEntity.businessLocationEvidence || []),
              ...updatedGeo.evidence
            ]));
            existingEntity.businessLocationReason = updatedGeo.reason;
            existingEntity.businessLocationReasonCode = updatedGeo.reasonCode;
          }

          if (intent) {
            const candEval = LeadRelevanceEngine.evaluateCandidate(cand, intent);
            if (candEval.decision === 'NOT_RELEVANT' && candEval.conflicts.some(c => c.type === 'CONTRADICTION' && c.strength === 'STRONG')) {
              existingEntity.relevanceDecision = 'NOT_RELEVANT';
              existingEntity.evaluationStatus = 'REJECTED';
              existingEntity.relevanceReasons = [...(existingEntity.relevanceReasons || []), ...candEval.reasons];
            } else if (candEval.decision === 'RELEVANT') {
              existingEntity.relevanceScore = Math.max(existingEntity.relevanceScore || 0, candEval.score);
            }
          }

          const qualGate = evaluateLeadQualificationGates(existingEntity, intent);
          existingEntity.status = qualGate.status;
          existingEntity.qualificationFailedGates = qualGate.failedGates;
          existingEntity.qualificationReasons = qualGate.reasons;

          entityIndex.indexEntity(mergeDecision.targetKey, existingEntity);

          if (!updatedEntities.some(e => e.id === existingEntity.id)) {
            updatedEntities.push(existingEntity);
          }
          continue;
        }
      }

      // 3. New candidate entity
      const entityKey = mergeDecision.targetKey;
      if (!seenEntityKeys.has(entityKey)) {
        counters.uniqueEntitiesObserved = (counters.uniqueEntitiesObserved || 0) + 1;
        seenEntityKeys.add(entityKey);
        newEntityKeysAdded.push(entityKey);
      }

      // 4. Evidence Waterfall & Strict Relevance v3 Evaluation
      let evalResult: any = null;
      let v3Result: any = null;
      if (intent) {
        evalResult = LeadRelevanceEngine.evaluateCandidate(cand, intent);
        v3Result = evaluateStrictRelevanceV3({
          advertiserName: cand.pageName,
          adText: cand.bodyCopy,
          destinationUrl: cand.destinationUrl,
          destinationDomain: cand.destinationDomain,
          facebookPageUrl: cand.facebookPageUrl,
          ctaText: cand.ctaText,
          matchedKeyword: cand.observedKeyword || currentKeyword
        }, intent);

        if (v3Result.reasonCode) {
          counters.reasonCodes![v3Result.reasonCode] = (counters.reasonCodes![v3Result.reasonCode] || 0) + 1;
        }

        if (v3Result.decision === 'NOT_RELEVANT') {
          counters.notRelevantCandidates++;
          if (!existingEntitiesMap.has(entityKey)) {
            seenRejectedEntityKeys.add(entityKey);
            seenUncertainEntityKeys.delete(entityKey);
          }
          counters.notRelevantEntities = seenRejectedEntityKeys.size;
          counters.uncertainEntities = seenUncertainEntityKeys.size;
          counters.relevantEntities = existingEntitiesMap.size;
          counters.uniqueEntitiesObserved = counters.relevantEntities + counters.notRelevantEntities + counters.uncertainEntities;
          // Non-relevant entity is recorded for audit/stats but not added to active leads
          continue;
        }

        if (v3Result.decision === 'UNCERTAIN') {
          counters.uncertainCandidates++;
          if (!existingEntitiesMap.has(entityKey) && !seenRejectedEntityKeys.has(entityKey)) {
            seenUncertainEntityKeys.add(entityKey);
          }
          counters.notRelevantEntities = seenRejectedEntityKeys.size;
          counters.uncertainEntities = seenUncertainEntityKeys.size;
          counters.relevantEntities = existingEntitiesMap.size;
          counters.uniqueEntitiesObserved = counters.relevantEntities + counters.notRelevantEntities + counters.uncertainEntities;
          // Construct durable UncertainEntityRecord and store in internal queue
          const existingUnc = existingUncertainMap.get(entityKey);
          const uncRecord = classifyUncertainCandidate(cand, v3Result, intent, entityKey, existingUnc);
          existingUncertainMap.set(entityKey, uncRecord);
          uncertainEntities.push(uncRecord);
          // Uncertain entity is excluded from qualified leads per Strict Relevance Gate v3
          continue;
        }
      }

      // 5. Geographic physical location evaluation
      const cleanName = normalizeAdvertiserName(cand.pageName);
      const pageNorm = normalizeFacebookPage(cand.facebookPageUrl, cand.facebookPageId);
      const domainNorm = normalizeDestinationDomain(cand.destinationUrl, cand.destinationDomain);

      const geoEval = evaluateGeographicOrigin({
        pageName: cleanName,
        pageUrl: pageNorm.canonicalUrl || cand.facebookPageUrl,
        destinationUrl: domainNorm.cleanUrl || cand.destinationUrl,
        destinationDomain: domainNorm.canonicalDomain || cand.destinationDomain,
        bodyCopy: cand.bodyCopy,
        ctaText: cand.ctaText
      }, countryCode);

      if (intent?.strictLocalMode) {
        if (geoEval.classification === 'FOREIGN_VERIFIED') {
          counters.notRelevantCandidates++;
          if (!existingEntitiesMap.has(entityKey)) {
            seenRejectedEntityKeys.add(entityKey);
            seenUncertainEntityKeys.delete(entityKey);
          }
          counters.notRelevantEntities = seenRejectedEntityKeys.size;
          counters.uncertainEntities = seenUncertainEntityKeys.size;
          counters.relevantEntities = existingEntitiesMap.size;
          counters.uniqueEntitiesObserved = counters.relevantEntities + counters.notRelevantEntities + counters.uncertainEntities;
          if (counters.reasonCodes) {
            counters.reasonCodes['FOREIGN_BUSINESS'] = (counters.reasonCodes['FOREIGN_BUSINESS'] || 0) + 1;
          }
          continue;
        }
        if (geoEval.classification === 'LOCATION_UNKNOWN' || (geoEval.classification === 'LOCAL_PROBABLE' && intent.allowProbableLocal === false)) {
          counters.uncertainCandidates++;
          if (!existingEntitiesMap.has(entityKey) && !seenRejectedEntityKeys.has(entityKey)) {
            seenUncertainEntityKeys.add(entityKey);
          }
          counters.notRelevantEntities = seenRejectedEntityKeys.size;
          counters.uncertainEntities = seenUncertainEntityKeys.size;
          counters.relevantEntities = existingEntitiesMap.size;
          counters.uniqueEntitiesObserved = counters.relevantEntities + counters.notRelevantEntities + counters.uncertainEntities;
          const code = geoEval.classification === 'LOCATION_UNKNOWN' ? 'LOCATION_UNKNOWN' : 'LOCAL_PROBABLE_DISALLOWED';
          if (counters.reasonCodes) {
            counters.reasonCodes[code] = (counters.reasonCodes[code] || 0) + 1;
          }
          continue;
        }
      }

      // 5.5. CTA & Destination evaluation
      const candCtaRes = cand.ctaType
        ? { ctaType: cand.ctaType, normalizedText: cand.ctaText || '', reasonCode: 'CTA_TEXT_MATCH', reason: '' }
        : classifyCta(cand.ctaText);
      const candDestRes = cand.destinationType
        ? { destinationType: cand.destinationType, confidence: cand.destinationConfidence || 'HIGH', reasonCode: cand.destinationReasonCode || 'VISIBLE_EXTERNAL_DESTINATION', reason: '' }
        : classifyDestination({
            destinationUrl: domainNorm.cleanUrl || cand.destinationUrl,
            destinationDomain: domainNorm.canonicalDomain || cand.destinationDomain,
            ctaText: cand.ctaText,
            ctaType: candCtaRes.ctaType,
            bodyCopy: cand.bodyCopy,
            rawText: cand.rawText
          });

      cand.ctaType = candCtaRes.ctaType;
      cand.destinationType = candDestRes.destinationType;
      cand.destinationReasonCode = candDestRes.reasonCode;
      cand.destinationConfidence = candDestRes.confidence;

      if (intent?.requiredCtaTypes && intent.requiredCtaTypes.length > 0) {
        if (!intent.requiredCtaTypes.includes(candCtaRes.ctaType)) {
          counters.notRelevantCandidates++;
          if (!existingEntitiesMap.has(entityKey)) {
            seenRejectedEntityKeys.add(entityKey);
            seenUncertainEntityKeys.delete(entityKey);
          }
          continue;
        }
      }

      if (intent?.requiredDestinationTypes && intent.requiredDestinationTypes.length > 0) {
        if (!intent.requiredDestinationTypes.includes(candDestRes.destinationType)) {
          counters.notRelevantCandidates++;
          if (!existingEntitiesMap.has(entityKey)) {
            seenRejectedEntityKeys.add(entityKey);
            seenUncertainEntityKeys.delete(entityKey);
          }
          continue;
        }
      }

      // 6. Qualified relevant entity
      counters.relevantCandidates++;

      // 7. Global safety ceiling check (MAX 5,000)
      const currentLeadCount = counters.finalUniqueRelevantLeads || counters.finalUniqueLeads;
      if (currentLeadCount >= effectiveCeiling) {
        safetyLimitReached = true;
        break;
      }

      // Construct unified ExtensionLead with identity metadata and evidence coverage
      const webState = (domainNorm.cleanUrl || cand.destinationUrl)
        ? 'found'
        : (candDestRes.destinationType === 'NO_VISIBLE_DESTINATION' ? 'not_found' : 'unknown');
      const fbState = (pageNorm.canonicalUrl || cand.facebookPageUrl) ? 'found' : 'not_found';

      const candAdEvidenceItem: AdLevelEvidence = {
        libraryId: cand.libraryId,
        ctaText: cand.ctaText,
        ctaType: candCtaRes.ctaType,
        destinationType: candDestRes.destinationType,
        destinationUrl: domainNorm.cleanUrl || cand.destinationUrl,
        destinationDomain: domainNorm.canonicalDomain || cand.destinationDomain,
        reasonCode: candDestRes.reasonCode,
        confidence: candDestRes.confidence,
        observedAt: cand.startedRunning || new Date().toISOString()
      };

      const newLead: ExtensionLead = {
        id: `lead_${runId}_${entityKey}`,
        name: cleanName,
        canonicalName: cleanName,
        canonicalPageId: pageNorm.pageId,
        canonicalPageSlug: pageNorm.pageSlug,
        facebookPageName: cleanName,
        facebookPageUrl: pageNorm.canonicalUrl || cand.facebookPageUrl,
        facebookPageState: fbState,
        destinationUrl: domainNorm.cleanUrl || cand.destinationUrl,
        destinationDomain: domainNorm.canonicalDomain || cand.destinationDomain,
        observedDomains: domainNorm.canonicalDomain ? [domainNorm.canonicalDomain] : [],
        observedUrls: cand.destinationUrl ? [cand.destinationUrl] : [],
        aliases: [],
        websiteState: webState,
        adCount: 1,
        activeAdCount: 1,
        adLibraryIds: [cand.libraryId],
        adLibraryUrl: `https://www.facebook.com/ads/library/?id=${cand.libraryId}`,
        matchedKeywords: currentKeyword ? [currentKeyword] : (intent?.primaryKeywords?.slice(0, 1) || []),
        matchedQueries: currentKeyword ? [currentKeyword] : (intent?.primaryKeywords?.slice(0, 1) || []),
        locationCode: countryCode,
        locationName: locationName,
        // Ad-level CTA & Destination Intelligence (Phase 0.4)
        adEvidence: [candAdEvidenceItem],
        observedCtaTexts: cand.ctaText ? [cand.ctaText] : [],
        observedCtaTypes: [candCtaRes.ctaType],
        observedDestinationTypes: [candDestRes.destinationType],
        primaryCtaType: candCtaRes.ctaType,
        primaryDestinationType: candDestRes.destinationType,
        destinationReasonCode: candDestRes.reasonCode,
        destinationConfidence: candDestRes.confidence,
        targetCountryCode: geoEval.targetCountryCode,
        businessCountryCode: geoEval.businessCountryCode,
        geographicClassification: geoEval.classification,
        businessLocationConfidence: geoEval.confidence,
        businessLocationEvidence: geoEval.evidence,
        businessLocationReason: geoEval.reason,
        status: 'REVIEW_REQUIRED', // evaluated below via evaluateLeadQualificationGates
        discoveredAt: new Date().toISOString(),
        sampleCopy: cand.bodyCopy,
        sampleCta: cand.ctaText,
        identityConfidence: mergeDecision.confidence,
        relationshipType: mergeDecision.relationshipType,
        mergeHistory: [],
        relevanceScore: v3Result?.score ?? evalResult?.score,
        relevanceDecision: v3Result?.decision ?? evalResult?.decision ?? 'UNASSESSED',
        relevanceConfidence: v3Result?.confidence ?? evalResult?.confidence,
        relevanceReasons: v3Result?.reasons ?? evalResult?.reasons,
        relevanceMatchedTerms: v3Result?.matchedTerms ?? evalResult?.matchedTerms,
        relevanceEvidence: v3Result?.evidence ?? evalResult?.evidence,
        relevanceStrategyVersion: v3Result?.strategyVersion ?? evalResult?.strategyVersion,
        engineVersion: v3Result?.engineVersion ?? evalResult?.engineVersion,
        presetVersion: v3Result?.presetVersion ?? evalResult?.presetVersion,
        evidenceCoverage: v3Result?.evidenceCoverage,
        evidenceExplanation: v3Result?.explanation,
        uniqueEvidenceSignals: v3Result?.uniqueEvidenceSignals,
        observedEvidenceOccurrences: v3Result?.observedEvidenceOccurrences,
        evaluationStatus: (v3Result?.decision ?? evalResult?.decision) === 'RELEVANT'
          ? 'RELEVANT'
          : (v3Result?.decision ?? evalResult?.decision) === 'NOT_RELEVANT'
            ? 'REJECTED'
            : (v3Result?.decision ?? evalResult?.decision) === 'UNCERTAIN'
              ? 'UNCERTAIN'
              : undefined,
        creativeSignals: extractCreativeSignalsFromCandidate(cand)
      };

    const qualGate = evaluateLeadQualificationGates(newLead, intent);
    newLead.status = qualGate.status;
    newLead.qualificationFailedGates = qualGate.failedGates;
    newLead.qualificationReasons = qualGate.reasons;

    // Check advertiser expansion eligibility
    const expEligibility = checkAdvertiserExpansionEligibility(
      newLead,
      options.alreadyExpandedEntityIds || new Set<string>(),
      counters.advertiserExpansionsCount || 0
    );
    newLead.advertiserExpansionStatus = expEligibility.status === 'ELIGIBLE' ? 'PENDING' : 'NOT_ELIGIBLE';

    existingEntitiesMap.set(entityKey, newLead);
    entityIndex.indexEntity(entityKey, newLead);
    updatedEntities.push(newLead);
    seenRejectedEntityKeys.delete(entityKey);
    seenUncertainEntityKeys.delete(entityKey);

    if (evalResult?.evidence) {
      newEvidence.push({
        canonicalKey: entityKey,
        evidence: evalResult.evidence
      });
    }

    counters.finalUniqueLeads++;
    counters.finalUniqueRelevantLeads = counters.finalUniqueLeads;
    counters.relevantEntities = existingEntitiesMap.size;
    counters.notRelevantEntities = seenRejectedEntityKeys.size;
    counters.uncertainEntities = seenUncertainEntityKeys.size;
    counters.uniqueEntitiesObserved = counters.relevantEntities + counters.notRelevantEntities + counters.uncertainEntities;
    newUniqueRelevantLeadsCount++;

    if (counters.finalUniqueLeads >= effectiveCeiling) {
      safetyLimitReached = true;
      break;
    }
  }

  // Mutate currentCounters in-place so caller state stays in sync across sequential batches
  Object.assign(currentCounters, counters);

  return {
    processedAds,
    updatedEntities,
    uncertainEntities,
    newEvidence,
    newAdIdsAdded,
    newEntityKeysAdded,
    counters,
    safetyLimitReached,
    newUniqueRelevantLeadsCount
  };
}
