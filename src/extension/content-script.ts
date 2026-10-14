/**
 * Chrome Extension Content Script for Public Meta Ad Library
 * Runs inside the context of https://www.facebook.com/ads/library/*
 * 
 * Hardened v1.7.1: Condition-based waiting, MutationObserver, structured diagnostics, leak-free cleanup.
 */

import { checkForBotChallenge, extractAdCardsWithDiagnostics } from './metaAdapter.ts';
import type { ExtensionMessage, AdExtractionResult, ExtractionResultStatus } from './types.ts';

console.log('[Meta Ad Library Scraper] Content script active on:', typeof window !== 'undefined' ? window.location?.href : 'unknown');

// Active cancellation hook for in-flight waits
let activeWaitCancellation: (() => void) | null = null;

/**
 * Checks whether the browser window is at or near the bottom of scrollable content.
 */
export function isAtBottomOfPage(doc: Document = document, win: Window = window): boolean {
  try {
    const scrollHeight = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
      doc.body?.offsetHeight || 0
    );
    const clientHeight = win.innerHeight || doc.documentElement?.clientHeight || 0;
    const currentScroll = win.scrollY || win.pageYOffset || 0;

    if (scrollHeight <= 0 || clientHeight <= 0) return false;
    return currentScroll + clientHeight >= scrollHeight - 250;
  } catch {
    return false;
  }
}

export interface DynamicWaitOptions {
  keyword: string;
  scroll?: boolean;
  quietPeriodMs?: number;
  maxWaitMs?: number;
  scrollIteration?: number;
  seenLibraryIds?: Set<string>;
}

/**
 * Condition-based wait for newly rendered Meta Ad Library cards.
 * Replaces fixed sleeps with MutationObserver + quiet period + max timeout deadline.
 */
export function waitForDynamicAdCards(
  doc: Document = document,
  win: Window = window,
  options: DynamicWaitOptions
): Promise<AdExtractionResult & { scrolled: boolean; atBottom: boolean }> {
  const {
    keyword,
    scroll = true,
    quietPeriodMs = 400,
    maxWaitMs = 3500,
    scrollIteration = 1,
    seenLibraryIds = new Set<string>()
  } = options;

  return new Promise((resolve) => {
    let finished = false;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;
    let relevantMutationsCount = 0;
    let scrolled = false;

    // Guaranteed cleanup on every exit path
    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
      if (maxWaitTimer) {
        clearTimeout(maxWaitTimer);
        maxWaitTimer = null;
      }
      if (activeWaitCancellation === cancelWait) {
        activeWaitCancellation = null;
      }
    };

    const finish = (statusOverride?: ExtractionResultStatus) => {
      if (finished) return;
      finished = true;
      cleanup();

      // Final extraction scan
      const extraction = extractAdCardsWithDiagnostics(doc, keyword, {
        seenLibraryIds,
        scrollIteration,
        relevantMutationsObserved: relevantMutationsCount
      });

      const atBottom = isAtBottomOfPage(doc, win);
      let finalStatus: ExtractionResultStatus = statusOverride || extraction.status;

      // Only establish END_OF_RESULTS if at bottom and no new results observed
      if (finalStatus === 'NO_NEW_RESULTS_OBSERVED' && atBottom) {
        finalStatus = 'END_OF_RESULTS';
      }

      resolve({
        ...extraction,
        status: finalStatus,
        scrolled,
        atBottom
      });
    };

    const cancelWait = () => {
      finish('CANCELLED');
    };
    activeWaitCancellation = cancelWait;

    try {
      // 1. Initial Challenge Check
      const initialChallenge = checkForBotChallenge(doc);
      if (initialChallenge.isBlocked) {
        finish(initialChallenge.code || 'CHALLENGED');
        return;
      }

      // 2. Initial scroll if requested
      if (scroll) {
        try {
          const prevScrollY = win.scrollY || win.pageYOffset || 0;
          if (typeof win.scrollBy === 'function') {
            win.scrollBy(0, 1200);
          }
          scrolled = (win.scrollY || win.pageYOffset || 0) > prevScrollY || true;
        } catch {
          scrolled = false;
        }
      }

      // 3. Initial scan: if results are ALREADY present in the DOM, allow quiet period for rendering to settle
      const initialScan = extractAdCardsWithDiagnostics(doc, keyword, { seenLibraryIds });
      if (initialScan.candidates.length > 0) {
        quietTimer = setTimeout(() => {
          finish('RESULTS_FOUND');
        }, quietPeriodMs);
      }

      // 4. Set up MutationObserver if supported
      const MutationObserverClass = (win as any).MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
      const targetNode = doc.body || doc.documentElement;

      if (MutationObserverClass && targetNode) {
        observer = new MutationObserverClass((mutations: MutationRecord[]) => {
          try {
            if (finished) return;

            let hasRelevantElements = false;
            for (const m of mutations) {
              if (m.type === 'childList' && m.addedNodes.length > 0) {
                for (let i = 0; i < m.addedNodes.length; i++) {
                  if (m.addedNodes[i].nodeType === 1) { // Node.ELEMENT_NODE
                    hasRelevantElements = true;
                    break;
                  }
                }
              }
              if (hasRelevantElements) break;
            }

            if (hasRelevantElements) {
              relevantMutationsCount++;

              // Check if challenge appeared during dynamic load
              const liveChallenge = checkForBotChallenge(doc);
              if (liveChallenge.isBlocked) {
                finish(liveChallenge.code || 'CHALLENGED');
                return;
              }

              // Check if new cards have arrived
              const currentScan = extractAdCardsWithDiagnostics(doc, keyword, { seenLibraryIds });
              if (currentScan.candidates.length > 0) {
                // Reset quiet timer to let batch settle
                if (quietTimer) clearTimeout(quietTimer);
                quietTimer = setTimeout(() => {
                  finish('RESULTS_FOUND');
                }, quietPeriodMs);
              } else {
                // Reset quiet timer
                if (quietTimer) clearTimeout(quietTimer);
                quietTimer = setTimeout(() => {
                  finish();
                }, quietPeriodMs);
              }
            }
          } catch {
            finish('EXTRACTION_ERROR');
          }
        });

        try {
          observer.observe(targetNode, { childList: true, subtree: true });
        } catch {
          // Fallback gracefully if observation fails on target
        }
      }

      // 5. Hard maximum wait deadline safety net
      maxWaitTimer = setTimeout(() => {
        finish();
      }, maxWaitMs);
    } catch {
      finish('EXTRACTION_ERROR');
    }
  });
}

// Notify service worker that content script is initialized
try {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      payload: { url: window.location.href, timestamp: Date.now() }
    }).catch(() => {
      // Background worker might be sleeping; normal in MV3
    });
  }
} catch {
  // Graceful fallback
}

// Listen for commands from the extension Service Worker
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === 'SCAN_AND_EXTRACT') {
      const keyword = message.payload?.keyword || '';
      const shouldScroll = message.payload?.scroll ?? true;
      const quietPeriodMs = message.payload?.quietPeriodMs;
      const maxWaitMs = message.payload?.maxWaitMs;
      const scrollIteration = message.payload?.scrollIteration;
      const seenIdsArray = message.payload?.seenLibraryIds || [];
      const seenLibraryIds = new Set<string>(seenIdsArray);

      // 1. Immediate Bot Challenge / CAPTCHA / Login Wall check
      const challenge = checkForBotChallenge(document);
      if (challenge.isBlocked) {
        sendResponse({
          type: 'CHALLENGE_DETECTED',
          reason: challenge.reason,
          code: challenge.code || 'CHALLENGED',
          payload: {
            candidates: [],
            count: 0,
            status: challenge.code || 'CHALLENGED',
            scrolled: false,
            atBottom: false
          }
        });
        return true;
      }

      // 2. Execute condition-based wait and extraction
      waitForDynamicAdCards(document, window, {
        keyword,
        scroll: shouldScroll,
        quietPeriodMs,
        maxWaitMs,
        scrollIteration,
        seenLibraryIds
      }).then((result) => {
        sendResponse({
          type: 'CANDIDATES_COLLECTED',
          payload: {
            candidates: result.candidates,
            count: result.candidates.length,
            status: result.status,
            diagnostics: result.diagnostics,
            scrolled: result.scrolled,
            atBottom: result.atBottom
          }
        });
      }).catch((err) => {
        sendResponse({
          type: 'CANDIDATES_COLLECTED',
          payload: {
            candidates: [],
            count: 0,
            status: 'EXTRACTION_ERROR',
            diagnostics: {
              cardsExamined: 0,
              identifierCandidatesFound: 0,
              validCardsAccepted: 0,
              cardsRejectedMissingId: 0,
              duplicateCardsIgnored: 0,
              extractionDurationMs: 0
            },
            scrolled: shouldScroll,
            atBottom: false,
            error: err?.message || 'Unknown extraction error'
          }
        });
      });

      return true; // Asynchronous response in Chrome MV3
    }

    if (message.type === 'CANCEL_RESEARCH' || message.type === 'STOP_RESEARCH') {
      if (activeWaitCancellation) {
        activeWaitCancellation();
      }
      sendResponse({ status: 'CANCELLED' });
      return false;
    }

    return false;
  });
}
