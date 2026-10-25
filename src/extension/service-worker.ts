/**
 * Chrome MV3 Service Worker
 * Manages research runs, tab orchestration, extraction loop, deduplication, and persistence in chrome.storage.local
 */

import {
  MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH
} from './types.ts';
import type {
  ExtensionMessage,
  ExtensionResearchRun,
  ExtensionLead,
  StartResearchPayload,
  ScrapedAdCandidate,
  RunCounters
} from './types.ts';
import { aggregateCandidatesToLeads, buildMetaAdLibrarySearchUrl } from './metaAdapter.ts';
import { compileResearchIntent, RELEVANCE_STRATEGY_VERSION, RELEVANCE_ENGINE_VERSION } from './relevanceEngine.ts';
import {
  initBulkStore,
  saveRunRecord,
  getRunRecord,
  saveBatch,
  getAllRelevantLeads,
  getAllStoredLeads,
  getSeenAdIds,
  getSeenEntityKeys,
  getLatestCheckpoint,
  recoverInterruptedRun,
  reconcileAndRecoverRun
} from './bulkStore.ts';
import { processBatch } from './bulkProcessor.ts';
import {
  planResearchQueries,
  QueryFrontier,
  MAX_QUERIES_PER_RESEARCH_RUN
} from './queryPlanner.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../config/collectionGate.ts';
import {
  evaluateLeadQualification,
  buildBusinessIntelligenceProfile,
  CANONICAL_DEFAULT_PROFILE,
  LOCAL_SERVICE_BUSINESS_PROFILE,
  B2B_PROSPECT_PROFILE,
  DIGITAL_COMMERCE_BUSINESS_PROFILE,
  HIGH_CONTACTABILITY_PROFILE
} from './qualification/index.ts';
import { RecordAssembler } from './leadIntelligence/index.ts';
import {
  exportLeadsWithReconciliation,
  validateExportSafeLead,
  generateDeterministicLeadId
} from './leads/index.ts';

const canonicalRecordAssembler = new RecordAssembler();

console.log('[Meta Ad Library Scraper] Service Worker initializing...');

// Constants for state integrity
const SCHEMA_VERSION = 1;
const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cancellation & pause flags (keyed by runId)
export const cancelledRuns = new Set<string>();
export const pausedRuns = new Set<string>();

/**
 * Persists active run state to chrome.storage.local
 */
export async function saveActiveRun(run: ExtensionResearchRun): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    run.lastUpdatedAt = new Date().toISOString();
    run.schemaVersion = SCHEMA_VERSION;
    await chrome.storage.local.set({
      activeResearchRun: run,
      meta_scraper_active_run: run
    });
  }
}

/**
 * Detects and reconciles in-flight or interrupted jobs on service worker startup
 */
export async function checkStaleJobs(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const data = await chrome.storage.local.get(['activeResearchRun']);
  const run = data.activeResearchRun as ExtensionResearchRun | undefined;

  if (run && ['STARTING', 'NAVIGATING', 'COLLECTING', 'NORMALIZING'].includes(run.status)) {
    console.warn('[service-worker] Detected in-flight job on service worker restart:', run.runId);

    // Check if run was cancelled in bulkStore
    const persisted = await getRunRecord(run.runId);
    if (persisted?.status === 'CANCELLED' || run.status === 'CANCELLED') {
      run.status = 'CANCELLED';
      run.stopReason = 'USER_CANCELLED';
    } else {
      // Reconcile and transition to RECOVERY_REQUIRED so user is never locked out
      const rec = await reconcileAndRecoverRun(run.runId, 'BROWSER_INTERRUPTED');
      run.status = 'RECOVERY_REQUIRED';
      run.stopReason = 'BROWSER_INTERRUPTED';
      run.leads = rec.run.leads;
      run.counters = rec.run.counters;
      run.totalAdsInspected = rec.run.totalAdsInspected;
    }

    run.lastUpdatedAt = new Date().toISOString();
    if (!run.logs) {
      run.logs = [];
    }
    run.logs.push({
      timestamp: new Date().toLocaleTimeString(),
      message: 'Background service worker restarted while research was in flight. State safely reconciled and preserved.',
      stage: 'SYSTEM'
    });
    await saveActiveRun(run);
    await appendToHistory(run);
  }
}

/**
 * Appends completed run to research history
 */
async function appendToHistory(run: ExtensionResearchRun): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(['researchHistory', 'meta_scraper_history']);
    const history: ExtensionResearchRun[] = Array.isArray(data.researchHistory)
      ? data.researchHistory
      : Array.isArray(data.meta_scraper_history) ? data.meta_scraper_history : [];
    // Keep last 30 runs
    const updated = [run, ...history.filter(h => h.runId !== run.runId)].slice(0, 30);
    await chrome.storage.local.set({
      researchHistory: updated,
      meta_scraper_history: updated
    });
  }
}

/**
 * Emits progress event to any active extension views (sidepanel/popup)
 */
export function broadcastProgress(run: ExtensionResearchRun, stage: string, logMessage: string): void {
  if (cancelledRuns.has(run.runId) && run.status !== 'CANCELLED') {
    run.status = 'CANCELLED';
    run.stopReason = 'USER_CANCELLED';
    stage = 'CANCELLED';
  }
  const timestamp = new Date().toLocaleTimeString();
  run.logs.push({ timestamp, message: logMessage, stage });
  // Keep logs bounded
  if (run.logs.length > 50) {
    run.logs = run.logs.slice(-50);
  }

  saveActiveRun(run).catch(() => {});

  const authoritativeLeadCount = run.counters?.finalUniqueRelevantLeads ?? run.counters?.finalUniqueLeads ?? run.leads.length;

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'RESEARCH_PROGRESS',
      payload: {
        runId: run.runId,
        status: run.status,
        leadCount: authoritativeLeadCount,
        maxResults: run.maxResults,
        totalAdsInspected: run.totalAdsInspected,
        logMessage,
        run
      }
    }).catch(() => {
      // No popup/sidepanel open right now; state is safely preserved in chrome.storage.local
    });
  }
}

/**
 * Checks whether current URL matches target Meta Ad Library search URL,
 * taking into account URL normalization, parameter ordering, and query keywords.
 */
export function isAdLibraryUrlMatch(currentUrl: string | undefined, targetUrl?: string): boolean {
  if (!currentUrl) return false;
  if (!targetUrl) return currentUrl.includes('/ads/library');
  try {
    const cur = new URL(currentUrl);
    const tgt = new URL(targetUrl);
    if (!cur.pathname.includes('/ads/library')) return false;
    const curQ = cur.searchParams.get('q')?.toLowerCase().trim();
    const tgtQ = tgt.searchParams.get('q')?.toLowerCase().trim();
    if (tgtQ && curQ) {
      return curQ === tgtQ;
    }
    return true;
  } catch {
    return currentUrl.includes('/ads/library');
  }
}

/**
 * Helper to wait for a tab to finish loading target URL.
 * Handles redirects, URL normalization, timeouts, tab closure, and repeated navigations.
 */
export function waitForTabLoad(tabId: number, targetUrl?: string, timeoutMs = 25000): Promise<void> {
  return new Promise(async (resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          chrome.tabs?.onUpdated?.removeListener(listener);
          chrome.tabs?.onRemoved?.removeListener(onTabRemoved);
        } catch {}
        resolve();
      }
    };

    const listener = (updatedTabId: number, changeInfo: { status?: string; url?: string }, tab?: chrome.tabs.Tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        if (!targetUrl || (tab?.url && isAdLibraryUrlMatch(tab.url, targetUrl))) {
          cleanup();
        }
      }
    };

    const onTabRemoved = (removedTabId: number) => {
      if (removedTabId === tabId) {
        cleanup();
      }
    };

    try {
      chrome.tabs?.onUpdated?.addListener(listener);
      chrome.tabs?.onRemoved?.addListener(onTabRemoved);
    } catch {}

    // Only resolve immediately if current tab is ALREADY on the target URL with matching keyword and complete
    try {
      const currentTab = await chrome.tabs.get(tabId);
      if (currentTab && currentTab.status === 'complete') {
        if (targetUrl && isAdLibraryUrlMatch(currentTab.url, targetUrl)) {
          cleanup();
          return;
        }
      }
    } catch {}

    setTimeout(cleanup, timeoutMs);
  });
}

/**
 * Helper to delay execution
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main research execution pipeline in Chrome Extension
 */
export async function executeResearchPipeline(
  payload: StartResearchPayload,
  providedRunId?: string,
  providedRun?: ExtensionResearchRun
): Promise<ExtensionResearchRun> {
  const runId = providedRunId || `run_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  cancelledRuns.delete(runId);
  pausedRuns.delete(runId);

  const keywords = payload.keywords.map(k => k.trim()).filter(Boolean);
  const countryCode = payload.countryCode || 'US';
  const requestedLimit = payload.maxFinalUniqueRelevantLeads ?? payload.maxResults;
  const isAutoDiscovery = payload.researchMode === 'AUTO_DISCOVERY' && requestedLimit === undefined;
  const effectiveCeiling = isAutoDiscovery
    ? MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH
    : Math.min(Math.max(1, requestedLimit || MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH), MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH);
  const targetLeadCount = isAutoDiscovery ? undefined : effectiveCeiling;

  // Fail-Closed Safety Gate (Phase 0.1): Live Meta scraping is disabled and unauthorized
  if (!isLiveCollectionPermitted()) {
    const blockedRun: ExtensionResearchRun = providedRun || {
      runId,
      researchName: payload.researchName || `${payload.mode === 'PRESET' ? payload.presetName || 'Preset' : keywords[0]} in ${payload.locationName}`,
      mode: payload.mode,
      presetId: payload.presetId,
      presetName: payload.presetName,
      keywords,
      countryCode,
      locationName: payload.locationName,
      researchMode: isAutoDiscovery ? 'AUTO_DISCOVERY' : undefined,
      maxFinalUniqueRelevantLeads: isAutoDiscovery ? MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH : undefined,
      maxResults: payload.maxResults ?? effectiveCeiling,
      targetLeadCount,
      status: 'BLOCKED',
      stopReason: 'COLLECTION_NOT_AUTHORIZED',
      leads: [],
      rejectedLeadsCount: 0,
      uncertainLeadsCount: 0,
      relevanceStrategyVersion: RELEVANCE_STRATEGY_VERSION,
      engineVersion: RELEVANCE_ENGINE_VERSION,
      counters: {
        rawAds: 0,
        normalizedCandidates: 0,
        relevantCandidates: 0,
        uncertainCandidates: 0,
        notRelevantCandidates: 0,
        duplicatesRemoved: 0,
        finalUniqueLeads: 0
      },
      logs: [
        {
          timestamp: new Date().toLocaleTimeString(),
          message: 'Live automated collection from Meta Ad Library is disabled and unauthorized (Phase 0A gate: NO-GO).',
          stage: 'SAFETY_GATE'
        }
      ],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      totalAdsInspected: 0
    };
    blockedRun.status = 'BLOCKED';
    blockedRun.stopReason = 'COLLECTION_NOT_AUTHORIZED';
    await saveActiveRun(blockedRun);
    broadcastProgress(blockedRun, 'BLOCKED', 'Live automated collection is disabled and unauthorized.');
    return blockedRun;
  }

  const researchIntent = compileResearchIntent(
    payload.mode,
    keywords,
    payload.presetId,
    countryCode,
    {
      strictLocalMode: payload.strictLocalMode,
      allowProbableLocal: payload.allowProbableLocal,
      requiredCtaTypes: payload.requiredCtaTypes as any,
      requiredDestinationTypes: payload.requiredDestinationTypes as any,
      websiteRequirement: payload.websiteRequirement
    }
  );

  const initialRun: ExtensionResearchRun = providedRun || {
    runId,
    researchName: payload.researchName || `${payload.mode === 'PRESET' ? payload.presetName || 'Preset' : keywords[0]} in ${payload.locationName}`,
    mode: payload.mode,
    presetId: payload.presetId,
    presetName: payload.presetName,
    keywords,
    countryCode,
    locationName: payload.locationName,
    strictLocalMode: payload.strictLocalMode,
    allowProbableLocal: payload.allowProbableLocal,
    requiredCtaTypes: payload.requiredCtaTypes,
    requiredDestinationTypes: payload.requiredDestinationTypes,
    websiteRequirement: payload.websiteRequirement,
    researchIntent: researchIntent,
    researchMode: isAutoDiscovery ? 'AUTO_DISCOVERY' : undefined,
    maxFinalUniqueRelevantLeads: isAutoDiscovery ? MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH : undefined,
    maxResults: payload.maxResults ?? effectiveCeiling,
    targetLeadCount: targetLeadCount,
    status: 'STARTING',
    leads: [],
    rejectedLeadsCount: 0,
    uncertainLeadsCount: 0,
    relevanceStrategyVersion: RELEVANCE_STRATEGY_VERSION,
    engineVersion: RELEVANCE_ENGINE_VERSION,
    counters: {
      rawAds: 0,
      normalizedCandidates: 0,
      relevantCandidates: 0,
      uncertainCandidates: 0,
      notRelevantCandidates: 0,
      duplicatesRemoved: 0,
      finalUniqueLeads: 0
    },
    logs: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    totalAdsInspected: 0
  };

  // Initialize bulk storage engine (IndexedDB)
  await initBulkStore();
  const seenAdLibraryIds = await getSeenAdIds(runId);
  const seenEntityKeys = await getSeenEntityKeys(runId);
  const seenRejectedEntityKeys = new Set<string>();
  const seenUncertainEntityKeys = new Set<string>();
  const existingEntitiesMap = new Map<string, ExtensionLead>();

  // If resuming, populate existing entities with all stored leads
  const existingLeads = await getAllStoredLeads(runId);
  for (const lead of existingLeads) {
    const primaryKey = lead.canonicalKey || (lead.canonicalPageId ? `fb_${lead.canonicalPageId}` : (lead.canonicalPageSlug ? `fbslug_${lead.canonicalPageSlug}` : (lead.canonicalName ? `name_${lead.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : `name_${lead.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`)));
    existingEntitiesMap.set(primaryKey, lead);
    if (lead.canonicalName) existingEntitiesMap.set(lead.canonicalName.toLowerCase(), lead);
    if (lead.name) existingEntitiesMap.set(lead.name.toLowerCase(), lead);
    if (lead.canonicalPageId) existingEntitiesMap.set(`fb_${lead.canonicalPageId}`, lead);
    if (lead.canonicalPageSlug) existingEntitiesMap.set(`fbslug_${lead.canonicalPageSlug}`, lead);
  }

  await saveActiveRun(initialRun);

  // Plan bounded, deterministic search queries
  const plannedQueries = initialRun.plannedQueries || planResearchQueries({
    seedKeywords: keywords,
    countryCode,
    runId,
    maxQueries: MAX_QUERIES_PER_RESEARCH_RUN
  });
  initialRun.plannedQueries = plannedQueries;

  const queryFrontier = initialRun.queryFrontier
    ? QueryFrontier.restore(initialRun.queryFrontier)
    : new QueryFrontier(
        runId,
        plannedQueries,
        initialRun.frontier?.completedKeywords || [],
        initialRun.activeQueryIndex ?? initialRun.activeKeywordIndex ?? 0
      );
  initialRun.queryFrontier = queryFrontier.serialize();

  const queriesToRun = plannedQueries.map(p => p.query);

  if (queriesToRun.length === 0) {
    initialRun.status = 'PARTIAL';
    initialRun.stopReason = 'NO_NEW_RESULTS_OBSERVED';
    initialRun.warningMessages = ['No valid search queries or keywords provided for research run.'];
    initialRun.hasWarnings = true;
    broadcastProgress(initialRun, 'PARTIAL', 'Research completed: No valid search queries provided.');
    initialRun.completedAt = new Date().toISOString();
    await saveRunRecord(initialRun);
    await saveActiveRun(initialRun);
    await appendToHistory(initialRun);
    return initialRun;
  }

  const startBroadcastMsg = isAutoDiscovery
    ? `Auto-discovery research initiated in ${payload.locationName} (${queriesToRun.length} planned queries)...`
    : `Research initiated for ${targetLeadCount} leads in ${payload.locationName} (${queriesToRun.length} planned queries)...`;
  broadcastProgress(initialRun, 'STARTING', startBroadcastMsg);

  let currentTabId: number | null = null;
  const startQi = initialRun.activeQueryIndex ?? initialRun.activeKeywordIndex ?? 0;
  const completedKeywords: string[] = [...(initialRun.frontier?.completedKeywords || [])];
  let isStalled = false;
  let batchIndex = initialRun.lastCheckpointBatch || 0;
  let encounteredExtractionError = false;

  try {
    for (let qi = startQi; qi < queriesToRun.length; qi++) {
      if (cancelledRuns.has(runId) || pausedRuns.has(runId)) break;
      const currentLeadCount = initialRun.counters?.finalUniqueRelevantLeads ?? initialRun.counters?.finalUniqueLeads ?? existingEntitiesMap.size;
      if (currentLeadCount >= effectiveCeiling) break;

      // Check for discovery saturation
      if (queryFrontier.getSaturationState().isSaturated) {
        broadcastProgress(initialRun, 'COLLECTING', 'Discovery saturation reached (consecutive queries produced zero new unique entities). Finalizing research.');
        break;
      }

      const currentPlannedQuery = plannedQueries[qi];
      const currentKeyword = currentPlannedQuery.query;
      initialRun.activeKeywordIndex = qi;
      initialRun.activeQueryIndex = qi;
      initialRun.currentKeyword = currentKeyword;
      initialRun.keywordsCompleted = completedKeywords.length;
      initialRun.totalKeywords = queriesToRun.length;
      initialRun.status = 'NAVIGATING';

      let queryRawAds = 0;
      let queryNormalizedAds = 0;
      let queryNewEntities = 0;
      let queryDuplicateEntities = 0;

      const searchUrl = buildMetaAdLibrarySearchUrl(countryCode, currentKeyword);
      const queryTypeLabel = currentPlannedQuery.variantType === 'SEED' ? 'Primary Seed' : `Expansion: ${currentPlannedQuery.variantType}`;
      broadcastProgress(initialRun, 'NAVIGATING', `[${qi + 1}/${queriesToRun.length} ${queryTypeLabel}] Opening Meta Ad Library for "${currentKeyword}" in ${countryCode}...`);

      try {
        if (!currentTabId) {
          const tab = await chrome.tabs.create({ url: searchUrl, active: false });
          currentTabId = tab.id || null;
        } else {
          await chrome.tabs.update(currentTabId, { url: searchUrl });
        }

        if (!currentTabId) {
          throw new Error('Failed to create or update browser tab for research.');
        }

        await waitForTabLoad(currentTabId, searchUrl);
        // Give DOM extra settle time for dynamic scripts
        await wait(2000);
      } catch (navErr: any) {
        broadcastProgress(initialRun, 'COLLECTING', `Query "${currentKeyword}" failed navigation: ${navErr.message}`);
        if (!initialRun.warningMessages) initialRun.warningMessages = [];
        initialRun.warningMessages.push(`Query "${currentKeyword}" navigation failed: ${navErr.message}`);
        initialRun.hasWarnings = true;
        completedKeywords.push(currentKeyword);
        continue;
      }

      initialRun.status = 'COLLECTING';
      broadcastProgress(initialRun, 'COLLECTING', `Connected to Ad Library. Starting ad collection for "${currentKeyword}"...`);

      let consecutiveNoNewCards = 0;
      let scrollAttempts = 0;
      // In Auto-Discovery mode, scroll through accessible results for currentKeyword until source exhaustion or stall
      const maxScrolls = isAutoDiscovery ? 60 : Math.max(25, Math.ceil((targetLeadCount || 10) * 3));

      while (scrollAttempts < maxScrolls && !cancelledRuns.has(runId)) {
        const liveCount = initialRun.counters?.finalUniqueRelevantLeads ?? initialRun.counters?.finalUniqueLeads ?? existingEntitiesMap.size;
        if (liveCount >= effectiveCeiling) break;

        scrollAttempts++;

        // Verify target research tab has not been closed by user
        try {
          const tabCheck = await chrome.tabs.get(currentTabId);
          if (!tabCheck) {
            initialRun.status = 'BROWSER_TAB_CLOSED';
            initialRun.stopReason = 'BROWSER_TAB_CLOSED';
            broadcastProgress(initialRun, 'BROWSER_TAB_CLOSED', 'Ad Library tab was closed during research.');
            break;
          }
        } catch {
          initialRun.status = 'BROWSER_TAB_CLOSED';
          initialRun.stopReason = 'BROWSER_TAB_CLOSED';
          broadcastProgress(initialRun, 'BROWSER_TAB_CLOSED', 'Ad Library tab was closed during research.');
          break;
        }

        // Send scan command to content script in the tab with timeout guard
        let response: any = null;
        const sendScanWithTimeout = (msg: any, ms = 20000): Promise<any> => {
          let timeoutTimer: any;
          const timeoutPromise = new Promise((_, reject) => {
            timeoutTimer = setTimeout(() => reject(new Error('TAB_TIMEOUT')), ms);
          });
          return Promise.race([
            chrome.tabs.sendMessage(currentTabId!, msg),
            timeoutPromise
          ]).finally(() => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
          });
        };

        try {
          response = await sendScanWithTimeout({
            type: 'SCAN_AND_EXTRACT',
            payload: {
              keyword: currentKeyword,
              scroll: true,
              scrollIteration: scrollAttempts,
              seenLibraryIds: Array.from(seenAdLibraryIds)
            }
          });
        } catch (err: any) {
          if (err?.message === 'TAB_TIMEOUT') {
            broadcastProgress(initialRun, 'COLLECTING', `Scan request timed out on "${currentKeyword}".`);
            if (!initialRun.warningMessages) initialRun.warningMessages = [];
            initialRun.warningMessages.push(`Tab scan timed out for "${currentKeyword}" on attempt ${scrollAttempts}.`);
            initialRun.hasWarnings = true;
          } else {
            // Content script might need dynamic injection if not yet auto-injected
            try {
              await chrome.scripting.executeScript({
                target: { tabId: currentTabId },
                files: ['content-script.js']
              });
              await wait(1000);
              response = await sendScanWithTimeout({
                type: 'SCAN_AND_EXTRACT',
                payload: {
                  keyword: currentKeyword,
                  scroll: true,
                  scrollIteration: scrollAttempts,
                  seenLibraryIds: Array.from(seenAdLibraryIds)
                }
              });
            } catch (scriptErr: any) {
              broadcastProgress(initialRun, 'COLLECTING', `Tab communication retry: ${scriptErr.message}`);
            }
          }
        }

        if (response && (response.type === 'CHALLENGE_DETECTED' || response.payload?.status === 'CHALLENGED' || response.payload?.status === 'RATE_LIMITED')) {
          const isRateLimit = response.code === 'RATE_LIMITED' || response.payload?.status === 'RATE_LIMITED' || (response.reason && response.reason.includes('rate limit'));
          initialRun.status = isRateLimit ? 'RATE_LIMITED' : 'CHALLENGED';
          initialRun.challengeReason = response.reason || 'Meta Ad Library security challenge presented.';
          initialRun.stopReason = isRateLimit ? 'RATE_LIMITED' : 'CHALLENGED';
          broadcastProgress(initialRun, initialRun.status, `Access restricted: ${initialRun.challengeReason}`);
          await saveRunRecord(initialRun);
          await saveActiveRun(initialRun);
          await appendToHistory(initialRun);
          return initialRun;
        }

        if (response?.payload?.status === 'EXTRACTION_ERROR') {
          encounteredExtractionError = true;
          if (!initialRun.warningMessages) initialRun.warningMessages = [];
          initialRun.warningMessages.push(`Extraction error on "${currentKeyword}": ${response.payload.error || 'DOM structure issue encountered during scan'}`);
          initialRun.hasWarnings = true;
          broadcastProgress(initialRun, 'COLLECTING', `Extraction diagnostic warning: ${response.payload.error || 'DOM structure issue encountered during scan'}`);
        }

        const candidates: ScrapedAdCandidate[] = (response && response.payload && response.payload.candidates) || [];

        if (candidates.length > 0) {
          batchIndex++;

          // Bounded batch processing: dedup, entity identity, Strict Relevance Gate v2, anti-inflation, 5000 ceiling
          const batchResult = await processBatch(
            candidates,
            existingEntitiesMap,
            seenAdLibraryIds,
            seenEntityKeys,
            initialRun.counters || {
              rawAds: 0,
              normalizedCandidates: 0,
              relevantCandidates: 0,
              uncertainCandidates: 0,
              notRelevantCandidates: 0,
              duplicatesRemoved: 0,
              finalUniqueLeads: 0,
              uniqueEntitiesObserved: 0,
              relevantEntities: 0,
              uncertainEntities: 0,
              notRelevantEntities: 0,
              keywordsCompleted: completedKeywords.length,
              keywordsTotal: keywords.length,
              finalUniqueRelevantLeads: 0,
              reasonCodes: {}
            },
            {
              runId,
              countryCode,
              locationName: payload.locationName,
              currentKeyword,
              intent: researchIntent,
              effectiveCeiling,
              seenRejectedEntityKeys,
              seenUncertainEntityKeys
            }
          );

          queryRawAds += candidates.length;
          queryNormalizedAds += batchResult.processedAds.length;
          queryNewEntities += batchResult.newEntityKeysAdded.length;
          queryDuplicateEntities += (candidates.length - batchResult.processedAds.length);

          // Persist batch into IndexedDB bulk store
          await saveBatch(runId, {
            batchIndex,
            ads: batchResult.processedAds,
            entities: batchResult.updatedEntities,
            evidence: batchResult.newEvidence,
            uncertainEntities: batchResult.uncertainEntities,
            checkpoint: {
              runId,
              batchIndex,
              monotonicRevision: batchIndex,
              timestamp: new Date().toISOString(),
              schemaVersion: 2,
              activeKeywordIndex: qi,
              activeQueryIndex: qi,
              currentKeyword,
              completedKeywords: [...completedKeywords],
              rawAdsCount: batchResult.counters.rawAds,
              normalizedCandidatesCount: batchResult.counters.normalizedCandidates,
              uniqueEntitiesCount: batchResult.counters.uniqueEntitiesObserved || 0,
              relevantEntitiesCount: batchResult.counters.relevantEntities || 0,
              uncertainEntitiesCount: batchResult.counters.uncertainEntities || 0,
              notRelevantEntitiesCount: batchResult.counters.notRelevantEntities || 0,
              duplicatesRemovedCount: batchResult.counters.duplicatesRemoved,
              finalUniqueRelevantLeads: batchResult.counters.finalUniqueRelevantLeads || batchResult.counters.finalUniqueLeads,
              seenLibraryIdsCount: seenAdLibraryIds.size,
              seenEntityKeysCount: seenEntityKeys.size,
              status: cancelledRuns.has(runId) ? 'CANCELLED' : initialRun.status,
              stopReason: cancelledRuns.has(runId) ? 'USER_CANCELLED' : initialRun.stopReason,
              isRecoverable: true
            }
          });

          // Maintain preview slice (up to 50 leads) for fast UI rendering
          const allLeadsList = Array.from(existingEntitiesMap.values());
          initialRun.leads = allLeadsList.slice(0, 50);
          initialRun.totalAdsInspected = batchResult.counters.rawAds;
          initialRun.counters = batchResult.counters;
          initialRun.rejectedLeadsCount = batchResult.counters.notRelevantCandidates;
          initialRun.uncertainLeadsCount = batchResult.counters.uncertainCandidates;
          initialRun.lastCheckpointBatch = batchIndex;
          initialRun.currentKeyword = currentKeyword;
          initialRun.keywordsCompleted = completedKeywords.length;
          initialRun.totalKeywords = queriesToRun.length;
          initialRun.entitiesEvaluated = batchResult.counters.uniqueEntitiesObserved || 0;
          initialRun.frontier = {
            activeKeywordIndex: qi,
            keywords: queriesToRun,
            currentKeyword,
            completedKeywords: [...completedKeywords],
            seenLibraryIdsCount: seenAdLibraryIds.size,
            seenEntityKeysCount: seenEntityKeys.size,
            lastBatchIndex: batchIndex,
            checkpointTimestamp: new Date().toISOString()
          };

          if (batchResult.processedAds.length === 0) {
            consecutiveNoNewCards++;
          } else {
            consecutiveNoNewCards = 0;
          }

          // Release memory references
          candidates.length = 0;
          batchResult.processedAds.length = 0;

          broadcastProgress(
            initialRun,
            'COLLECTING',
            `Discovered ${initialRun.counters.finalUniqueRelevantLeads || initialRun.counters.finalUniqueLeads} leads | Inspected ${initialRun.counters.rawAds} ads | Evaluated ${initialRun.counters.uniqueEntitiesObserved || 0} entities (${currentKeyword})...`
          );

          const finalLeadsCount = initialRun.counters.finalUniqueRelevantLeads || initialRun.counters.finalUniqueLeads;
          if (batchResult.safetyLimitReached || finalLeadsCount >= effectiveCeiling) {
            if (isAutoDiscovery) {
              broadcastProgress(initialRun, 'NORMALIZING', `5,000-lead safety limit reached.`);
            } else {
              broadcastProgress(initialRun, 'NORMALIZING', `Target lead quota of ${targetLeadCount} reached.`);
            }
            break;
          }

          if ((response.payload && response.payload.atBottom && consecutiveNoNewCards >= 2) || response.payload?.status === 'END_OF_RESULTS') {
            broadcastProgress(initialRun, 'COLLECTING', `Reached end of public search results for "${currentKeyword}".`);
            break;
          }

          if (consecutiveNoNewCards >= 3) {
            isStalled = true;
            broadcastProgress(initialRun, 'COLLECTING', `No additional ad cards loaded for "${currentKeyword}". Moving forward.`);
            break;
          }
        } else {
          broadcastProgress(initialRun, 'COLLECTING', `Waiting for ad cards to render (attempt ${scrollAttempts})...`);
          await wait(2000);
        }
      }

      // Record query yield metrics in frontier
      queryFrontier.recordQueryMetrics(qi, {
        rawAds: queryRawAds,
        normalizedAds: queryNormalizedAds,
        newUniqueEntities: queryNewEntities,
        duplicateEntities: queryDuplicateEntities,
        rejectedByRelevance: 0,
        uncertainByRelevance: 0
      });
      initialRun.queryFrontier = queryFrontier.serialize();

      completedKeywords.push(currentKeyword);
      initialRun.keywordsCompleted = completedKeywords.length;
      if ((initialRun.counters?.finalUniqueRelevantLeads || initialRun.counters?.finalUniqueLeads || 0) >= effectiveCeiling) {
        break;
      }
    }

    const finalLeadCount = initialRun.counters?.finalUniqueRelevantLeads ?? initialRun.counters?.finalUniqueLeads ?? existingEntitiesMap.size;

    // Finalize state
    if (cancelledRuns.has(runId)) {
      initialRun.status = 'CANCELLED';
      initialRun.stopReason = 'USER_CANCELLED';
      broadcastProgress(initialRun, 'CANCELLED', `Research was explicitly cancelled by user.`);
    } else if (initialRun.stopReason === 'BROWSER_TAB_CLOSED' || initialRun.status === 'BROWSER_TAB_CLOSED') {
      initialRun.status = 'BROWSER_TAB_CLOSED';
      initialRun.stopReason = 'BROWSER_TAB_CLOSED';
      broadcastProgress(initialRun, 'BROWSER_TAB_CLOSED', `Research halted because the Ad Library tab was closed.`);
    } else if (initialRun.status === 'CHALLENGED' || initialRun.status === 'RATE_LIMITED' || initialRun.status === 'BLOCKED') {
      // Preserve security challenge or rate-limit state
    } else if (finalLeadCount >= effectiveCeiling) {
      initialRun.status = 'COMPLETED';
      if (isAutoDiscovery) {
        initialRun.stopReason = 'SAFETY_LIMIT_REACHED';
        broadcastProgress(
          initialRun,
          'COMPLETED',
          `Research stopped at the current system safety limit of 5,000 unique relevant leads.`
        );
      } else {
        initialRun.stopReason = 'TARGET_REACHED';
        broadcastProgress(
          initialRun,
          'COMPLETED',
          `Target lead quota of ${targetLeadCount} reached.`
        );
      }
    } else {
      if (initialRun.totalAdsInspected === 0 && encounteredExtractionError) {
        initialRun.status = 'FAILED';
        initialRun.stopReason = 'EXTRACTION_ERROR';
        initialRun.challengeReason = 'Extraction failed: Meta Ad Library card structure could not be extracted.';
        broadcastProgress(initialRun, 'FAILED', `Extraction error: Could not extract ad cards from page.`);
      } else {
        initialRun.status = 'PARTIAL';
        if (encounteredExtractionError) {
          if (!initialRun.warningMessages) initialRun.warningMessages = [];
          initialRun.warningMessages.push('One or more queries encountered an extraction error during collection; partial valid results preserved.');
          initialRun.hasWarnings = true;
        }
        if (initialRun.totalAdsInspected === 0) {
          initialRun.stopReason = 'NO_NEW_RESULTS_OBSERVED';
        } else if (isStalled) {
          initialRun.stopReason = 'SOURCE_PROGRESS_STALLED';
        } else {
          initialRun.stopReason = 'SOURCE_EXHAUSTED';
        }
        initialRun.completedAt = new Date().toISOString();
        const completionMsg = isAutoDiscovery
          ? `Auto-discovery finished (${initialRun.status} / ${initialRun.stopReason}): ${finalLeadCount} qualifying unique relevant leads discovered from ${initialRun.totalAdsInspected} public ads.`
          : `Research finished (${initialRun.status} / ${initialRun.stopReason}): ${finalLeadCount} of ${targetLeadCount} requested unique relevant leads observed from ${initialRun.totalAdsInspected} public ads.`;
        broadcastProgress(
          initialRun,
          initialRun.status,
          completionMsg
        );
      }
    }

  } catch (err: any) {
    if (cancelledRuns.has(runId) || initialRun.status === 'CANCELLED') {
      initialRun.status = 'CANCELLED';
      initialRun.stopReason = 'USER_CANCELLED';
      broadcastProgress(initialRun, 'CANCELLED', `Research was explicitly cancelled by user.`);
    } else if (existingEntitiesMap.size > 0) {
      initialRun.status = 'PARTIAL';
      initialRun.stopReason = 'PARTIAL_ERROR';
      if (!initialRun.warningMessages) initialRun.warningMessages = [];
      initialRun.warningMessages.push(`Research halted unexpectedly, but ${existingEntitiesMap.size} discovered leads were preserved: ${err.message}`);
      initialRun.hasWarnings = true;
      broadcastProgress(initialRun, 'PARTIAL', `Partial results saved (${existingEntitiesMap.size} leads): ${err.message}`);
    } else {
      initialRun.status = 'FAILED';
      initialRun.stopReason = 'FAILED';
      initialRun.challengeReason = err.message || 'Unexpected error occurred during research.';
      broadcastProgress(initialRun, 'FAILED', `Error: ${initialRun.challengeReason}`);
    }
  } finally {
    // Optionally close the automated research tab
    if (currentTabId) {
      try {
        await chrome.tabs.remove(currentTabId);
      } catch {}
    }

    if (cancelledRuns.has(runId) || initialRun.status === 'CANCELLED') {
      initialRun.status = 'CANCELLED';
      initialRun.stopReason = 'USER_CANCELLED';
    }

    initialRun.completedAt = new Date().toISOString();
    await saveRunRecord(initialRun);
    await saveActiveRun(initialRun);
    await appendToHistory(initialRun);

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'RESEARCH_COMPLETED',
        payload: { run: initialRun }
      }).catch(() => {});
    }
  }

  return initialRun;
}

// Global Message Listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message.type === 'START_RESEARCH') {
      // Duplicate execution prevention
      chrome.storage.local.get(['activeResearchRun'], (data) => {
        const activeRun = data.activeResearchRun as ExtensionResearchRun | undefined;
        if (activeRun && ['STARTING', 'NAVIGATING', 'COLLECTING', 'NORMALIZING'].includes(activeRun.status)) {
          const lastUpdate = new Date(activeRun.lastUpdatedAt).getTime();
          if (Date.now() - lastUpdate < STALE_JOB_THRESHOLD_MS) {
            sendResponse({ success: false, error: 'A research job is already active.' });
            return;
          }
        }

        const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const isAutoDiscovery = message.payload.researchMode === 'AUTO_DISCOVERY' || message.payload.maxResults === undefined;
        const effectiveCeiling = isAutoDiscovery
          ? MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH
          : Math.min(Math.max(1, message.payload.maxResults || MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH), MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH);
        const targetLeadCount = isAutoDiscovery ? undefined : effectiveCeiling;
        const keywords = message.payload.keywords.map(k => (k || '').trim()).filter(Boolean);

        const researchIntent = compileResearchIntent(
          message.payload.mode,
          keywords,
          message.payload.presetId,
          message.payload.countryCode || 'US',
          {
            strictLocalMode: message.payload.strictLocalMode,
            allowProbableLocal: message.payload.allowProbableLocal,
            requiredCtaTypes: message.payload.requiredCtaTypes as any,
            requiredDestinationTypes: message.payload.requiredDestinationTypes as any,
            websiteRequirement: message.payload.websiteRequirement
          }
        );

        const initialRun: ExtensionResearchRun = {
          runId,
          researchName: message.payload.researchName || `${message.payload.mode === 'PRESET' ? message.payload.presetName || 'Preset' : keywords[0]} in ${message.payload.locationName}`,
          mode: message.payload.mode,
          presetId: message.payload.presetId,
          presetName: message.payload.presetName,
          keywords,
          countryCode: message.payload.countryCode || 'US',
          locationName: message.payload.locationName,
          strictLocalMode: message.payload.strictLocalMode,
          allowProbableLocal: message.payload.allowProbableLocal,
          requiredCtaTypes: message.payload.requiredCtaTypes,
          requiredDestinationTypes: message.payload.requiredDestinationTypes,
          websiteRequirement: message.payload.websiteRequirement,
          researchIntent: researchIntent,
          researchMode: isAutoDiscovery ? 'AUTO_DISCOVERY' : undefined,
          maxFinalUniqueRelevantLeads: isAutoDiscovery ? MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH : undefined,
          maxResults: message.payload.maxResults ?? effectiveCeiling,
          targetLeadCount,
          status: 'STARTING',
          leads: [],
          rejectedLeadsCount: 0,
          uncertainLeadsCount: 0,
          relevanceStrategyVersion: RELEVANCE_STRATEGY_VERSION,
          engineVersion: RELEVANCE_ENGINE_VERSION,
          counters: {
            rawAds: 0,
            normalizedCandidates: 0,
            relevantCandidates: 0,
            uncertainCandidates: 0,
            notRelevantCandidates: 0,
            duplicatesRemoved: 0,
            finalUniqueLeads: 0
          },
          logs: [],
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          schemaVersion: SCHEMA_VERSION,
          totalAdsInspected: 0
        };

        // Fail-Closed Safety Gate (Phase 0.1): Live Meta scraping is disabled and unauthorized
        if (!isLiveCollectionPermitted()) {
          initialRun.status = 'BLOCKED';
          initialRun.stopReason = 'COLLECTION_NOT_AUTHORIZED';
          initialRun.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            message: 'Live automated collection from Meta Ad Library is disabled and unauthorized (Phase 0A gate: NO-GO).',
            stage: 'SAFETY_GATE'
          });
          saveActiveRun(initialRun).catch(() => {});
          broadcastProgress(initialRun, 'BLOCKED', 'Live automated collection is disabled and unauthorized.');
          sendResponse({ success: false, runId, run: initialRun, error: 'COLLECTION_NOT_AUTHORIZED: Live automated collection is disabled and unauthorized.' });
          return false;
        }

        // Persist immediate starting state
        saveActiveRun(initialRun).catch(() => {});

        // Launch async pipeline in background
        executeResearchPipeline(message.payload, runId, initialRun).catch(err => {
          console.error('[service-worker] Background pipeline error:', err);
        });

        // Respond immediately with created run and runId
        sendResponse({ success: true, runId, run: initialRun });
      });
      return true; // async sendResponse
    }

    if (message.type === 'STOP_RESEARCH' || message.type === 'CANCEL_RESEARCH') {
      const runId = message.payload?.runId;
      if (runId) {
        cancelledRuns.add(runId);
      }
      chrome.storage.local.get(['activeResearchRun'], async (data: Record<string, any>) => {
        if (data && data.activeResearchRun) {
          const run = data.activeResearchRun as ExtensionResearchRun;
          if (!runId || run.runId === runId) {
            run.status = 'CANCELLED';
            run.stopReason = 'USER_CANCELLED';
            run.completedAt = run.completedAt || new Date().toISOString();
            run.lastUpdatedAt = new Date().toISOString();
            run.logs.push({
              timestamp: new Date().toLocaleTimeString(),
              message: 'Research was explicitly cancelled by user.',
              stage: 'CANCELLED'
            });
            await saveActiveRun(run).catch(() => {});
            await saveRunRecord(run).catch(() => {});
            await appendToHistory(run).catch(() => {});
          }
        }
      });
      sendResponse({ success: true, message: 'Cancellation signal sent.' });
      return false;
    }

    if (message.type === 'RECOVER_RUN') {
      const targetRunId = message.payload?.runId;
      if (!targetRunId) {
        sendResponse({ success: false, error: 'runId required for recovery' });
        return false;
      }
      reconcileAndRecoverRun(targetRunId)
        .then(async (result) => {
          await saveActiveRun(result.run);
          await appendToHistory(result.run);
          sendResponse({
            success: true,
            run: result.run,
            diagnostics: result.diagnostics
          });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message.type === 'PAUSE_RESEARCH') {
      const runId = message.payload?.runId;
      if (runId) {
        pausedRuns.add(runId);
      }
      chrome.storage.local.get(['activeResearchRun'], (data: Record<string, any>) => {
        if (data && data.activeResearchRun) {
          const run = data.activeResearchRun as ExtensionResearchRun;
          run.status = 'PAUSED';
          run.stopReason = 'USER_PAUSED';
          saveActiveRun(run).catch(() => {});
        }
      });
      sendResponse({ success: true, message: 'Pause signal sent.' });
      return false;
    }

    if (message.type === 'GET_STATE') {
      chrome.storage.local.get(['activeResearchRun'], (result) => {
        sendResponse({ activeResearchRun: result.activeResearchRun || null });
      });
      return true;
    }

    if (message.type === 'GET_HISTORY') {
      chrome.storage.local.get(['researchHistory'], (result) => {
        sendResponse({ history: result.researchHistory || [] });
      });
      return true;
    }

    if (message.type === 'CLEAR_HISTORY') {
      chrome.storage.local.set({ researchHistory: [] }, () => {
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === 'GET_ALL_LEADS_FOR_EXPORT') {
      const targetRunId = message.payload?.runId;
      if (!targetRunId) {
        sendResponse({ success: false, error: 'runId required' });
        return false;
      }
      getAllRelevantLeads(targetRunId)
        .then(leads => {
          sendResponse({ success: true, leads });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (message.type === 'RESUME_RESEARCH') {
      sendResponse({
        success: false,
        error: 'COLLECTION_NOT_AUTHORIZED: Live automated collection is disabled and unauthorized.'
      });
      return false;
    }

    if (message.type === 'VERIFY_WEBSITE') {
      sendResponse({
        success: false,
        error: 'CRAWLER_DISABLED_BY_POLICY: External website crawling is disabled by product policy.'
      });
      return false;
    }

    if (message.type === 'EVALUATE_BUSINESS_QUALIFICATION') {
      try {
        const payload = (message as any).payload || {};
        const profiles: Record<string, any> = {
          CANONICAL_DEFAULT_PROFILE,
          LOCAL_SERVICE_BUSINESS_PROFILE,
          B2B_PROSPECT_PROFILE,
          DIGITAL_COMMERCE_BUSINESS_PROFILE,
          HIGH_CONTACTABILITY_PROFILE
        };
        const profile = payload.profile || (typeof payload.profileId === 'string' && profiles[payload.profileId]) || CANONICAL_DEFAULT_PROFILE;
        const bi = payload.businessIntelligence || (payload.buildParams ? buildBusinessIntelligenceProfile(payload.buildParams) : undefined);
        const context = {
          entityId: payload.entityId || 'entity_direct',
          businessIntelligence: bi,
          websiteState: payload.websiteState,
          sourceContributions: payload.sourceContributions
        };
        const decision = evaluateLeadQualification(context, profile);
        sendResponse({ success: true, decision, businessIntelligence: bi });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'ASSEMBLE_CANONICAL_LEAD') {
      try {
        const payload = (message as any).payload || {};
        const canonicalRecord = canonicalRecordAssembler.assemble(payload);
        const exportEvaluation = canonicalRecordAssembler.evaluateExport(canonicalRecord);
        sendResponse({
          success: true,
          canonicalRecord,
          exportEvaluation
        });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'EXPORT_LEADS_RECONCILED') {
      try {
        const payload = (message as any).payload || {};
        const leads = Array.isArray(payload.leads) ? payload.leads : [];
        const summary = exportLeadsWithReconciliation(leads);
        sendResponse({
          success: true,
          summary
        });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'GENERATE_DETERMINISTIC_LEAD_ID') {
      try {
        const payload = (message as any).payload || {};
        const leadId = generateDeterministicLeadId(payload.domain || '', payload.sourceAnchorId);
        sendResponse({
          success: true,
          leadId
        });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    return false;
  });
}

// Initialize on service worker boot
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[Meta Ad Library Scraper] Extension installed successfully.');
  });
}

// Perform stale job check on startup
checkStaleJobs().catch(err => console.error('[service-worker] checkStaleJobs error:', err));
