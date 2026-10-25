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
import { compileResearchIntent, LeadRelevanceEngine } from '../relevanceEngine.ts';
import { getManualImportRuns, saveManualImportAtomically } from '../bulkStore.ts';
import { evaluateLeadQualificationGates } from '../qualificationGate.ts';
import { evaluateGeographicOrigin } from '../geographicClassifier.ts';
import { observedWebsiteState, classifyCta, classifyDestination } from '../destinationClassifier.ts';

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
  exclusions?: string[];
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
  run?: ExtensionResearchRun;
}

let importQueue: Promise<unknown> = Promise.resolve();

function sameImportScope(run: ExtensionResearchRun, options: ManualImportOptions, keywords: string[], countryCode: string): boolean {
  const normalize = (values: string[]) => [...new Set(values.map(v => v.trim().toLowerCase()))].sort().join('\n');
  return run.countryCode === countryCode && normalize(run.keywords || []) === normalize(keywords)
    && (run.presetId || '') === (options.presetId || '')
    && (run.strictLocalMode !== false) === (options.strictLocalMode !== false)
    && (run.allowProbableLocal === true) === (options.allowProbableLocal === true)
    && normalize(run.exclusions || []) === normalize(options.exclusions || []);
}

function chromeStorageCall<T>(operation: (done: (result: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Browser workspace save timed out.')), 5000);
    try {
      operation(result => {
        clearTimeout(timer);
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Browser storage failed.'));
        else resolve(result);
      });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}

/** Serialize read/dedup/commit across popup and sidepanel contexts. */
export function executeManualImport(candidates: ScrapedAdCandidate[], options: ManualImportOptions = {}): Promise<ManualImportSummary> {
  const execute = () => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('leadnoria-manual-import', () => executeImport(candidates, options))
    : executeImport(candidates, options);
  const result = importQueue.then(execute, execute);
  importQueue = result.catch(() => undefined);
  return result;
}

/**
 * Executes offline import and qualification on user-supplied candidates.
 */
async function executeImport(
  candidates: ScrapedAdCandidate[],
  options: ManualImportOptions = {}
): Promise<ManualImportSummary> {
  const countryCode = (options.countryCode || 'BD').trim().toUpperCase();
  const locationName = options.locationName || (countryCode === 'BD' ? 'Bangladesh' : countryCode);
  const strictLocalMode = options.strictLocalMode !== false;
  const allowProbableLocal = options.allowProbableLocal === true;
  const keywords = options.keywords && options.keywords.length > 0 ? options.keywords : ['Commercial', 'Business'];

  const runId = options.runId || `manual_${crypto.randomUUID()}`;
  const runName = options.runName || `Manual Meta Import (${locationName})`;
  const previousRuns = (await getManualImportRuns()).filter(run => sameImportScope(run, options, keywords, countryCode));
  const savedIds = new Set(previousRuns.flatMap(run => run.leads.flatMap(lead => lead.adLibraryIds || [])));
  const newCandidates = candidates.filter(candidate => !savedIds.has(candidate.libraryId));
  const previousDuplicateCount = candidates.length - newCandidates.length;
  if (candidates.length > 0 && newCandidates.length === 0) {
    return { runId: previousRuns[0]?.runId || runId, totalSupplied: candidates.length, acceptedCount: 0,
      duplicateCount: previousDuplicateCount, rejectedCount: 0, incompleteCount: 0, leads: [], rejectedDetails: [],
      warnings: ['These ads were already imported for the same country and research criteria. No duplicate records were saved.'],
      run: previousRuns[0] };
  }

  // 1. Compile research intent with strict local requirements
  const intent = compileResearchIntent(
    'MANUAL',
    keywords,
    options.presetId,
    countryCode,
    {
      strictLocalMode,
      allowProbableLocal,
      exclusions: options.exclusions
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
  const preparedCandidates = newCandidates.map(c => ({
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
  batchResult.counters.duplicatesRemoved += previousDuplicateCount;
  batchResult.counters.rawAds += previousDuplicateCount;
  batchResult.counters.duplicateAdRecordsRemoved = (batchResult.counters.duplicateAdRecordsRemoved || 0) + previousDuplicateCount;

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
    const relevance = LeadRelevanceEngine.evaluateCandidate(cand, intent);
    const isExcluded = relevance.reasonCode === 'REJECT_PRESET_EXCLUSION';
    const cta = classifyCta(cand.ctaText);
    const destination = classifyDestination({ destinationUrl: cand.destinationUrl,
      destinationDomain: cand.destinationDomain, ctaType: cta.ctaType, bodyCopy: cand.bodyCopy });

    const unrankedLead: ExtensionLead = {
      id: `lead_${runId}_${cand.libraryId}`,
      name: cand.pageName,
      canonicalName: cand.pageName,
      facebookPageName: cand.pageName,
      facebookPageUrl: cand.facebookPageUrl,
      facebookPageState: cand.facebookPageUrl ? 'found' : 'not_found',
      destinationUrl: cand.destinationUrl,
      destinationDomain: cand.destinationDomain,
      websiteState: observedWebsiteState(cand.destinationUrl, cand.destinationDomain),
      primaryCtaType: cta.ctaType,
      primaryDestinationType: destination.destinationType,
      observedCtaTypes: [cta.ctaType],
      observedDestinationTypes: [destination.destinationType],
      destinationConfidence: destination.confidence,
      destinationReasonCode: destination.reasonCode,
      activeAdCount: cand.isActive === false ? 0 : 1,
      activeAdLibraryIds: cand.isActive === false ? [] : [cand.libraryId],
      adLibraryIds: [cand.libraryId],
      adLibraryUrl: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(cand.libraryId)}`,
      sampleCopy: cand.bodyCopy || cand.rawText,
      sampleCta: cand.ctaText,
      adEvidence: [{ libraryId: cand.libraryId, ctaText: cand.ctaText, normalizedCtaText: cta.normalizedText,
        ctaType: cta.ctaType, ctaStatus: cta.status, ctaConfidence: cta.confidence,
        destinationType: destination.destinationType, destinationUrl: cand.destinationUrl,
        destinationDomain: cand.destinationDomain, confidence: destination.confidence,
        reasonCode: destination.reasonCode, observedAt: now }],
      matchedKeywords: [keywords[0] || 'Commercial'],
      locationCode: countryCode,
      locationName,
      discoveredAt: now,
      targetCountryCode: countryCode,
      businessCountryCode: geoEval.businessCountryCode,
      geographicClassification: geoEval.classification,
      businessLocationConfidence: geoEval.confidence,
      businessLocationEvidence: geoEval.evidence,
      businessLocationReason: geoEval.reason,
      businessLocationReasonCode: geoEval.reasonCode,
      relevanceDecision: isForeign || isExcluded ? 'NOT_RELEVANT' : 'UNCERTAIN',
      status: isForeign || isExcluded ? 'REVIEW_REQUIRED' : 'NEEDS_DATA',
      evaluationStatus: isForeign || isExcluded ? 'REJECTED' : 'UNCERTAIN',
      relevanceReasonCode: isExcluded ? relevance.reasonCode : undefined,
      relevanceReasons: isExcluded ? relevance.reasons : [geoEval.reason || (isForeign ? 'Foreign business entity' : 'Incomplete signal evidence')],
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
    lead.qualificationFailedGates = gateRes.failedGates;
    lead.qualificationReasons = [...gateRes.reasons, ...(lead.relevanceReasonCode === 'REJECT_PRESET_EXCLUSION' ? lead.relevanceReasons || [] : [])];
    const gateReason = (gateRes.reasons && gateRes.reasons.length > 0)
      ? lead.qualificationReasons.join('; ')
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
    presetId: options.presetId,
    presetName: options.presetName,
    keywords,
    exclusions: options.exclusions,
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
    allCandidates: newCandidates
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

  await saveManualImportAtomically(researchRun, { batchIndex: 1, ads: preparedCandidates,
    entities: leads, uncertainEntities: batchResult.uncertainEntities, checkpoint });
  const warnings: string[] = [];

  // 8. Persist to chrome.storage.local for UI hydration
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const data = await chromeStorageCall<Record<string, any>>(done => chrome.storage.local.get(['researchHistory'], done));
      const history = Array.isArray(data.researchHistory) ? data.researchHistory : [];
      await chromeStorageCall<void>(done => chrome.storage.local.set({ activeResearchRun: researchRun,
        researchHistory: [researchRun, ...history.filter((r: any) => r && r.runId !== runId)].slice(0, 50)
      }, done));
    } catch (err) {
      warnings.push('Leads were saved in the research database, but the browser workspace snapshot could not be updated. Your saved import remains available in History.');
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
    warnings,
    run: researchRun
  };
}
