/**
 * LeadNoria Collection Safety Gate
 * Phase 0.1 — Collection Safety Lock and Safe Development Boundary
 *
 * Non-Negotiable Invariants:
 * 1. Default State: LIVE COLLECTION IS DISABLED (Fail-Closed).
 * 2. Missing, undefined, or malformed state unconditionally evaluates to disabled.
 * 3. Enforced strictly at execution boundaries (Service Worker pipeline, Server Browser Worker).
 * 4. External website deep crawling is permanently disabled by policy.
 * 5. Synthetic fixture execution for local development/testing is explicitly preserved.
 */

export interface CollectionAuthorizationStatus {
  isAuthorized: boolean;
  reason: string;
  allowedExecutionModes: Array<'SYNTHETIC_FIXTURE' | 'OFFLINE_TEST' | 'LOCAL_DEVELOPMENT'>;
  disallowedExecutionModes: Array<'LIVE_SCRAPE' | 'EXTERNAL_CRAWL' | 'AUTOMATED_COLLECTION'>;
}

export const LIVE_COLLECTION_STATUS: CollectionAuthorizationStatus = {
  isAuthorized: false,
  reason: 'Production automated collection from Meta Ad Library is unauthorized under platform terms (Meta ToS Section 3.2).',
  allowedExecutionModes: ['SYNTHETIC_FIXTURE', 'OFFLINE_TEST', 'LOCAL_DEVELOPMENT'],
  disallowedExecutionModes: ['LIVE_SCRAPE', 'EXTERNAL_CRAWL', 'AUTOMATED_COLLECTION']
};

/**
 * Returns whether automated live collection from Meta Ad Library is authorized.
 * Immutable fail-closed gate: Always returns false unless explicit legal/platform authorization exists.
 */
export function isLiveCollectionPermitted(): boolean {
  return false;
}

/**
 * Throws a fail-closed exception if live collection is attempted.
 */
export function assertLiveCollectionPermitted(): void {
  if (!isLiveCollectionPermitted()) {
    throw new Error(
      `COLLECTION_NOT_AUTHORIZED: ${LIVE_COLLECTION_STATUS.reason}`
    );
  }
}

/**
 * Returns whether external website deep crawling or probing is authorized.
 * Immutable fail-closed gate: Always returns false per non-negotiable product constraints.
 */
export function isExternalWebsiteCrawlingPermitted(): boolean {
  return false;
}

/**
 * Throws a fail-closed exception if external website crawling is attempted.
 */
export function assertExternalWebsiteCrawlingPermitted(): void {
  if (!isExternalWebsiteCrawlingPermitted()) {
    throw new Error(
      'CRAWLER_DISABLED_BY_POLICY: External website crawling and probing are prohibited by non-negotiable product constraints.'
    );
  }
}
