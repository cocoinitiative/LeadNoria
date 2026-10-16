/**
 * LeadNoria Phase 34 — Manual Import Orchestrator
 *
 * Connects parsed manual signals directly to the existing offline processing and qualification pipeline:
 * - Deduplication via seenAdLibraryIds
 * - Entity resolution and anti-inflation (1 advertiser with multiple ads = 1 entity)
 * - Strict geographic classification (evaluates local vs foreign physical evidence)
 * - Strict relevance classification (relevanceEngine & evidenceWaterfall)
 * - Qualification gates & quality scoring
 * - Local storage persistence (bulkStore & chrome.storage.local)
 *
 * NON-NEGOTIABLE SAFETY CONSTRAINTS:
 * - 100% offline local processing. Zero network access.
 * - Does not alter isLiveCollectionPermitted() === false.
 * - Clear source provenance: USER_SUPPLIED_META_SIGNAL / MANUAL_META_IMPORT.
 */

import type {
  ScrapedAdCandidate,
  ExtensionLead,
  ExtensionResearchRun,
  RunCounters,
  CheckpointRecord
} from '../types.ts';
import { processBatch } from '../bulkProcessor.ts';
import { compileResearchIntent } from '../relevanceEngine.ts';
import { saveRunRecord, saveBatch } from '../bulkStore.ts';
import { evaluateLeadQualificationGates } from '../qualificationGate.ts';
import { evaluateGeographicOrigin } from '../geographicClassifier.ts';

export interface ManualImportOptions {
  countryCode?: string;
  locationName?: string;
  strictLocalMode?: boolean;
  allowProbableLocal?: boolean;
  keywords?: string[];
  presetId?: string;
  presetName?: string;
  runId?: string;
  runName?: string;
}

export interface ManualImportSummary {
  runId: string;
  totalSupplied: number;
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  incompleteCount: number;
  leads: ExtensionLead[];
  rejectedDetails: Array<{ id: string; name: string; reason: string }>;
  warnings: string[];
}

/**
 * Executes offline import and qualification on user-supplied candidates.
 */
export async function executeManualImport(
  candidates: ScrapedAdCandidate[],
  options: ManualImportOptions = {}
): Promise<ManualImportSummary> {
  const countryCode = options.countryCode || 'BD';
  const locationName = options.locationName || (countryCode === 'BD' ? 'Bangladesh' : countryCode);
  const strictLocalMode = options.strictLocalMode !== false;
  const allowProbableLocal = options.allowProbableLocal !== false;
  const keywords = options.keywords && options.keywords.length > 0 ? options.keywords : ['Commercial', 'Business'];

  const runId = options.runId || `manual_${Date.now()}`;
  const runName = options.runName || `Manual Meta Import (${locationName})`;

  // 1. Compile research intent with strict local requirements
  const intent = compileResearchIntent(
    'MANUAL',
    keywords,
    options.presetId,
    countryCode,
    {
      strictLocalMode,
      allowProbableLocal
    }
  );

  // 2. Prepare state for batch processing
  const existingEntitiesMap = new Map<string, ExtensionLead>();
  const seenAdLibraryIds = new Set<string>();
  const seenEntityKeys = new Set<string>();

  const initialCounters: RunCounters = {
    rawAds: 0,
    normalizedCandidates: 0,
    relevantCandidates: 0,
    uncertainCandidates: 0,
    notRelevantCandidates: 0,
    duplicatesRemoved: 0,
    duplicateAdRecordsRemoved: 0,
    entityMergesCount: 0,
    finalUniqueLeads: 0,
    finalUniqueRelevantLeads: 0,
    uniqueEntitiesObserved: 0,
    relevantEntities: 0,
    uncertainEntities: 0,
    notRelevantEntities: 0,
    keywordsCompleted: 1,
    keywordsTotal: 1,
    reasonCodes: {}
  };

  // Ensure candidate observedKeyword aligns with active keywords
  const preparedCandidates = candidates.map(c => ({
    ...c,
    observedKeyword: (c.observedKeyword && c.observedKeyword !== 'MANUAL_IMPORT' && c.observedKeyword !== 'USER_CSV_IMPORT' && c.observedKeyword !== 'MANUAL_URL_REFERENCE')
      ? c.observedKeyword
      : keywords[0] || 'Commercial'
  }));

  // 3. Re-use existing bulk processing pipeline
  const batchResult = await processBatch(
    preparedCandidates,
    existingEntitiesMap,
    seenAdLibraryIds,
    seenEntityKeys,
    initialCounters,
    {
      runId,
      countryCode,
      locationName,
      currentKeyword: keywords[0],
      intent,
      effectiveCeiling: 5000
    }
  );

  // 4. Assemble final lead list and mark provenance
  const now = new Date().toISOString();
  const leads: ExtensionLead[] = Array.from(existingEntitiesMap.values()).map(lead => {
    return {
      ...lead,
      provenance: 'USER_SUPPLIED_META_SIGNAL',
      provenanceLineage: 'MANUAL_META_IMPORT'
    } as ExtensionLead;
  });

  // Track library IDs included in accepted leads
  const acceptedLibIds = new Set<string>();
  for (const l of leads) {
    for (const id of l.adLibraryIds) acceptedLibIds.add(id);
  }

  // Also include rejected and uncertain candidates as explicit non-qualified records
  for (const cand of preparedCandidates) {
    if (acceptedLibIds.has(cand.libraryId)) continue;
    acceptedLibIds.add(cand.libraryId);

    const geoEval = evaluateGeographicOrigin({
      pageName: cand.pageName,
      pageUrl: cand.facebookPageUrl,
      destinationUrl: cand.destinationUrl,
      destinationDomain: cand.destinationDomain,
      bodyCopy: cand.bodyCopy,
      ctaText: cand.ctaText
    }, countryCode);

    const isForeign = geoEval.classification === 'FOREIGN_VERIFIED';

    const unrankedLead: ExtensionLead = {
      id: `lead_${runId}_${cand.libraryId}`,
      name: cand.pageName,
      canonicalName: cand.pageName,
      facebookPageName: cand.pageName,
      facebookPageUrl: cand.facebookPageUrl,
      facebookPageState: cand.facebookPageUrl ? 'found' : 'not_found',
      destinationUrl: cand.destinationUrl,
      destinationDomain: cand.destinationDomain,
      websiteState: cand.destinationUrl ? 'found' : 'unknown',
      activeAdCount: 1,
      adLibraryIds: [cand.libraryId],
      matchedKeywords: [keywords[0] || 'Commercial'],
      locationCode: countryCode,
      locationName,
      discoveredAt: now,
      targetCountryCode: countryCode,
      businessCountryCode: geoEval.businessCountryCode || (isForeign ? 'US' : countryCode),
      geographicClassification: geoEval.classification,
      businessLocationConfidence: geoEval.confidence,
      businessLocationEvidence: geoEval.evidence,
      businessLocationReason: geoEval.reason,
      businessLocationReasonCode: geoEval.reasonCode,
      relevanceDecision: isForeign ? 'NOT_RELEVANT' : 'UNCERTAIN',
      status: isForeign ? 'REVIEW_REQUIRED' : 'NEEDS_DATA',
      evaluationStatus: isForeign ? 'REJECTED' : 'UNCERTAIN',
      relevanceReasons: [geoEval.reason || (isForeign ? 'Foreign business entity' : 'Incomplete signal evidence')],
      contactProfile: {
        observedPhones: cand.observedPhones || [],
        observedEmails: cand.observedEmails || [],
        phoneConflict: false,
        emailConflict: false,
        phoneConflictState: 'NOT_APPLICABLE',
        emailConflictState: 'NOT_APPLICABLE',
        overallQualityState: (cand.observedPhones?.length || 0) > 0 || (cand.observedEmails?.length || 0) > 0 ? 'OBSERVED_VALID_SYNTAX' : 'NOT_OBSERVED',
        diagnostics: []
      },
      provenance: 'USER_SUPPLIED_META_SIGNAL',
      provenanceLineage: 'MANUAL_META_IMPORT'
    };

    leads.push(unrankedLead);
  }

  // 5. Evaluate qualification gates for accurate categorization
  const rejectedDetails: Array<{ id: string; name: string; reason: string }> = [];
  let acceptedCount = 0;
  let rejectedCount = 0;
  let incompleteCount = 0;

  for (const lead of leads) {
    const gateRes = evaluateLeadQualificationGates(lead, intent);
    const gateReason = (gateRes.reasons && gateRes.reasons.length > 0)
      ? gateRes.reasons.join('; ')
      : (gateRes.failedGates && gateRes.failedGates.length > 0)
      ? `Failed gates: ${gateRes.failedGates.join(', ')}`
      : 'Incomplete evidence (pending verification)';

    if (gateRes.isQualified) {
      acceptedCount++;
    } else if (gateRes.canonicalOutcome === 'REJECTED' || lead.evaluationStatus === 'REJECTED') {
      rejectedCount++;
      rejectedDetails.push({
        id: lead.id,
        name: lead.name,
        reason: gateReason
      });
    } else {
      incompleteCount++;
      rejectedDetails.push({
        id: lead.id,
        name: lead.name,
        reason: gateReason
      });
    }
  }

  // 6. Build ExtensionResearchRun record
  const researchRun: ExtensionResearchRun = {
    runId,
    researchName: runName,
    mode: 'MANUAL',
    keywords,
    countryCode,
    locationName,
    strictLocalMode,
    allowProbableLocal,
    researchIntent: intent,
    status: 'COMPLETED',
    stopReason: 'MANUAL_IMPORT_COMPLETE',
    leads,
    counters: batchResult.counters,
    logs: [
      {
        timestamp: new Date().toLocaleTimeString(),
        message: `Manual import completed. Processed ${candidates.length} ads: ${acceptedCount} qualified, ${incompleteCount} incomplete, ${rejectedCount} rejected, ${batchResult.counters.duplicatesRemoved} duplicates.`,
        stage: 'IMPORT'
      }
    ],
    startedAt: now,
    completedAt: now,
    lastUpdatedAt: now,
    schemaVersion: 2,
    totalAdsInspected: candidates.length,
    allCandidates: candidates
  };

  // 7. Persist to bulkStore (IndexedDB / Memory fallback)
  const checkpoint: CheckpointRecord = {
    runId,
    batchIndex: 1,
    timestamp: now,
    activeKeywordIndex: 0,
    currentKeyword: keywords[0] || 'MANUAL',
    rawAdsCount: candidates.length,
    normalizedCandidatesCount: batchResult.counters.normalizedCandidates,
    uniqueEntitiesCount: leads.length,
    relevantEntitiesCount: acceptedCount,
    uncertainEntitiesCount: incompleteCount,
    notRelevantEntitiesCount: rejectedCount,
    duplicatesRemovedCount: batchResult.counters.duplicatesRemoved,
    finalUniqueRelevantLeads: acceptedCount,
    seenLibraryIdsCount: seenAdLibraryIds.size,
    seenEntityKeysCount: existingEntitiesMap.size
  };

  try {
    await Promise.race([
      (async () => {
        await saveBatch(runId, {
          batchIndex: 1,
          ads: batchResult.processedAds,
          entities: leads,
          uncertainEntities: batchResult.uncertainEntities,
          checkpoint
        });
        await saveRunRecord(researchRun);
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB save timed out')), 2000))
    ]);
  } catch (err) {
    console.warn('[ManualImport] Error persisting to bulkStore:', err);
  }

  // 8. Persist to chrome.storage.local for UI hydration
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          chrome.storage.local.get(['researchHistory'], (data) => {
            const history = Array.isArray(data.researchHistory) ? data.researchHistory : [];
            const updatedHistory = [researchRun, ...history.filter((r: any) => r && r.runId !== runId)].slice(0, 50);

            chrome.storage.local.set({
              activeResearchRun: researchRun,
              researchHistory: updatedHistory
            }, () => resolve());
          });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('chrome.storage save timed out')), 2000))
      ]);
    } catch (err) {
      console.warn('[ManualImport] Error saving to chrome.storage.local:', err);
    }
  }

  return {
    runId,
    totalSupplied: candidates.length,
    acceptedCount,
    duplicateCount: batchResult.counters.duplicatesRemoved,
    rejectedCount,
    incompleteCount,
    leads,
    rejectedDetails,
    warnings: []
  };
}
