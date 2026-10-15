/**
 * Chrome MV3 Meta Ad Library Scraper Extension Types
 */

export const MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH = 5000;

export type ResearchMode = 'CUSTOM' | 'PRESET';
export type ResearchModelType = 'AUTO_DISCOVERY';

export type JobStatus =
  | 'IDLE'
  | 'STARTING'
  | 'NAVIGATING'
  | 'COLLECTING'
  | 'NORMALIZING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'PAUSED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'FAILED'
  | 'RECOVERY_REQUIRED'
  | 'BROWSER_TAB_CLOSED'
  | 'BROWSER_INTERRUPTED'
  | 'RATE_LIMITED'
  | 'CHALLENGED';

export type ResearchStopReason =
  | 'TARGET_REACHED'
  | 'SAFETY_LIMIT_REACHED'
  | 'SOURCE_EXHAUSTED'
  | 'SOURCE_EXHAUSTED_VERIFIED'
  | 'SOURCE_PROGRESS_STALLED'
  | 'NO_NEW_RESULTS_OBSERVED'
  | 'USER_CANCELLED'
  | 'BROWSER_INTERRUPTED'
  | 'BROWSER_TAB_CLOSED'
  | 'RATE_LIMITED'
  | 'CHALLENGED'
  | 'CHALLENGE_DETECTED'
  | 'STALE_JOB_TIMEOUT'
  | 'FAILED'
  | 'FATAL_ERROR'
  | 'EXTRACTION_ERROR'
  | 'END_OF_RESULTS'
  | 'TAB_TIMEOUT';

export type RelevanceDecision = 'RELEVANT' | 'UNCERTAIN' | 'NOT_RELEVANT' | 'UNASSESSED';
export type RelevanceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type EvidenceStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY';

export type EvidenceType =
  | 'ENTITY_IDENTITY'
  | 'CATEGORY_MATCH'
  | 'COMMERCIAL_INTENT'
  | 'PRODUCT_OR_SERVICE_SIGNAL'
  | 'DESTINATION_MATCH'
  | 'FACEBOOK_PAGE_SIGNAL'
  | 'DOMAIN_SIGNAL'
  | 'NEGATIVE_CATEGORY'
  | 'CONTRADICTION'
  | 'QUERY_CONTEXT'
  | 'WEBSITE_IDENTITY'
  | 'WEBSITE_CATEGORY'
  | 'WEBSITE_COMMERCIAL'
  | 'WEBSITE_DESTINATION'
  | 'WEBSITE_NEGATIVE'
  | 'WEBSITE_CONTACT'
  | 'WEBSITE_LOCATION';

export type EvidenceSource =
  | 'advertiser_name'
  | 'ad_text'
  | 'destination_url'
  | 'destination_domain'
  | 'facebook_page'
  | 'cta_text'
  | 'entity_aggregation'
  | 'matched_query'
  | 'product_catalog'
  | 'cross_query_merge'
  | 'website_verification';

export interface StructuredEvidence {
  type: EvidenceType;
  strength: EvidenceStrength;
  source: EvidenceSource;
  reason: string;
  matchedSignal?: string;
  reasonCode?: string;
  value?: string;
  explanation?: string;
  signature?: string;
  occurrenceCount?: number;
}

export type EvidenceCoverageLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvidenceCoverage {
  applicableCategoriesPresent: number;
  applicableCategoriesTotal: number;
  coverageRatio: number;
  coverageLevel: EvidenceCoverageLevel;
  presentCategories: EvidenceType[];
  missingCategories: EvidenceType[];
}

export interface StrictV3Decision {
  decision: RelevanceDecision;
  confidence: RelevanceConfidence;
  score: number;
  reasons: string[];
  matchedKeywords: string[];
  matchedTerms: string[];
  negativeSignals: string[];
  evidence: StructuredEvidence[];
  conflicts: StructuredEvidence[];
  evidenceCoverage: EvidenceCoverage;
  uniqueEvidenceSignals: number;
  observedEvidenceOccurrences: number;
  explanation: string;
  reasonCode: string;
  strategyVersion: number;
  engineVersion: string;
  presetVersion?: string;
}

export type UncertainReasonCode =
  | 'UNCERTAIN_KEYWORD_ONLY'
  | 'UNCERTAIN_AMBIGUOUS_ENTITY'
  | 'UNCERTAIN_MISSING_IDENTITY'
  | 'UNCERTAIN_MISSING_CATEGORY_EVIDENCE'
  | 'UNCERTAIN_CONFLICT_NOT_RESOLVED'
  | 'UNCERTAIN_SHARED_MARKETPLACE'
  | 'UNCERTAIN_LIMITED_PUBLIC_EVIDENCE';

export interface UncertainEntityRecord {
  entityId: string;
  entityKey?: string;
  canonicalName: string;
  observedNames: string[];
  advertiserName?: string;
  matchedQueries: string[];
  identityConfidence: IdentityConfidence;
  evidenceItems: StructuredEvidence[];
  evidence?: StructuredEvidence[];
  missingEvidence: string[];
  reasonCodes: string[];
  primaryReasonCode: string;
  reasonCode?: string;
  reasons?: string[];
  observedAdIds: string[];
  observedDomains: string[];
  facebookPageInfo?: {
    pageName?: string;
    pageUrl?: string;
    pageId?: string;
  };
  timestamps: {
    firstDiscovered: string;
    lastEvaluated: string;
  };
  recordedAt?: string;
  decision?: 'UNCERTAIN';
  confidence?: RelevanceConfidence;
  queryProvenance?: string[];
  uncertainReasonCodes?: string[];
  lastEvaluationState: {
    score: number;
    decision: 'UNCERTAIN';
    confidence: RelevanceConfidence;
    explanation?: string;
  };
  evidenceCoverage?: EvidenceCoverage;
}

export type CreativeSignalType =
  | 'CTA'
  | 'OFFER'
  | 'DISCOUNT'
  | 'PRICE'
  | 'COMMERCIAL_INTENT'
  | 'PRODUCT_TERM'
  | 'SERVICE_TERM'
  | 'CREATIVE_TYPE'
  | 'LANGUAGE';

export interface StructuredCreativeSignal {
  type: CreativeSignalType;
  rawSignal: string;
  normalized: string;
  occurrences: number;
}

export type AdvertiserExpansionStatus =
  | 'NOT_ELIGIBLE'
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'NO_RESULTS'
  | 'BLOCKED'
  | 'FAILED';

export interface AdvertiserExpansionProvenance {
  expansionType: 'ADVERTISER';
  sourceEntityId: string;
  sourceAdvertiserName: string;
  expansionQuery: string;
  query?: string;
  timestamp: string;
  resultCount: number;
  newAdsDiscovered: number;
  newAds?: number;
  duplicateAds: number;
  newEntitiesDiscovered: number;
  newEntities?: number;
  stopReason: 'SOURCE_EXHAUSTED' | 'MAX_ADS_REACHED' | 'RATE_LIMITED' | 'TIMEOUT' | 'NO_NEW_DATA' | 'ERROR' | 'COMPLETED_SUCCESSFULLY';
}

export interface RunCounters {
  rawAds: number;
  normalizedCandidates: number;
  relevantCandidates: number;
  uncertainCandidates: number;
  notRelevantCandidates: number;
  duplicatesRemoved: number;
  duplicateAdRecordsRemoved?: number;
  entityMergesCount?: number;
  finalUniqueLeads: number;
  // Enhanced Phase 2 bulk counters
  uniqueEntitiesObserved?: number;
  relevantEntities?: number;
  uncertainEntities?: number;
  notRelevantEntities?: number;
  keywordsCompleted?: number;
  keywordsTotal?: number;
  finalUniqueRelevantLeads?: number;
  reasonCodes?: Record<string, number>;
  // Prompt 5: Advertiser Expansion counters
  advertiserExpansionsCount?: number;
  advertiserExpansionAdsCount?: number;
  advertiserExpansionDuplicatesCount?: number;
}

export type QueryVariantType =
  | 'SEED'
  | 'CATEGORY_SYNONYM'
  | 'PRODUCT_TERM'
  | 'SERVICE_TERM'
  | 'COMMERCIAL_CATEGORY'
  | 'SINGULAR_PLURAL'
  | 'COMMON_SPELLING_VARIANT'
  | 'LOCALE_VARIANT';

export type QueryStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'NO_RESULTS'
  | 'NO_NEW_ENTITIES';

export interface PlannedQuery {
  query: string;
  seedQuery: string;
  variantType: QueryVariantType;
  rationale: string;
  locale: string;
  country: string;
  sequence: number;
  runId?: string;
  status?: QueryStatus;
  rawAds?: number;
  normalizedAds?: number;
  newUniqueEntities?: number;
  duplicateEntities?: number;
  rejectedByRelevance?: number;
  uncertainByRelevance?: number;
  yield?: number;
}

export interface QueryFrontierState {
  runId: string;
  activeQueryIndex: number;
  queries: PlannedQuery[];
  completedQueries: string[];
  isSaturated?: boolean;
  saturationReason?: string;
  consecutiveZeroYieldCount?: number;
}

export interface KeywordFrontierState {
  activeKeywordIndex: number;
  keywords: string[];
  currentKeyword: string;
  completedKeywords: string[];
  seenLibraryIdsCount: number;
  seenEntityKeysCount: number;
  lastBatchIndex: number;
  checkpointTimestamp: string;
}

export interface CheckpointRecord {
  runId: string;
  batchIndex: number;
  monotonicRevision?: number;
  timestamp: string;
  schemaVersion?: number;
  activeKeywordIndex: number;
  activeQueryIndex?: number;
  currentKeyword: string;
  completedKeywords?: string[];
  rawAdsCount: number;
  normalizedCandidatesCount: number;
  uniqueEntitiesCount: number;
  relevantEntitiesCount: number;
  uncertainEntitiesCount: number;
  notRelevantEntitiesCount: number;
  duplicatesRemovedCount: number;
  finalUniqueRelevantLeads: number;
  seenLibraryIdsCount: number;
  seenEntityKeysCount: number;
  status?: JobStatus;
  stopReason?: string;
  isRecoverable?: boolean;
}

export type CtaType =
  | 'SHOP_NOW'
  | 'LEARN_MORE'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'SEND_MESSAGE'
  | 'CALL_NOW'
  | 'DOWNLOAD'
  | 'GET_QUOTE'
  | 'OTHER'
  | 'UNKNOWN';

export type DestinationType =
  | 'EXTERNAL_WEBSITE'
  | 'INSTANT_FORM'
  | 'MESSAGING'
  | 'CALL'
  | 'APP'
  | 'OTHER'
  | 'UNKNOWN'
  | 'NO_VISIBLE_DESTINATION';

export type {
  ContactFieldType,
  ContactSourceSurface,
  ContactSyntaxState,
  ContactVerificationStatus,
  ContactConflictState,
  ContactQualityState,
  ContactObservation,
  ContactEntityProfile
} from './contactQuality.ts';
import type {
  ContactObservation,
  ContactEntityProfile,
  ContactQualityState
} from './contactQuality.ts';

export type {
  PrioritizationTier,
  ComponentScoreContribution,
  LeadScoreBreakdown,
  LeadPrioritizationResult
} from './leadPrioritizer.ts';
export { SCORING_MODEL_VERSION } from './leadPrioritizer.ts';
import type {
  PrioritizationTier,
  LeadScoreBreakdown
} from './leadPrioritizer.ts';
export interface LeadExportOptions {
  qualifiedOnly?: boolean;
  reviewOnly?: boolean;
  rejectedOnly?: boolean;
  strictLocalMode?: boolean;
  requiredCtaTypes?: CtaType[];
  requiredDestinationTypes?: DestinationType[];
  pretty?: boolean;
}

export interface AdLevelEvidence {
  libraryId: string;
  ctaText?: string;
  normalizedCtaText?: string;
  ctaType: CtaType;
  ctaConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  ctaStatus?: string;
  destinationType: DestinationType;
  destinationUrl?: string;
  destinationDomain?: string;
  reasonCode: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  observedAt?: string;
  contactObservations?: ContactObservation[];
}

export interface ScrapedAdCandidate {
  libraryId: string;
  pageName: string;
  facebookPageUrl?: string;
  facebookPageId?: string;
  destinationUrl?: string;
  destinationDomain?: string;
  isActive: boolean;
  startedRunning?: string;
  hasMultipleVersions?: boolean;
  bodyCopy?: string;
  ctaText?: string;
  ctaType?: CtaType;
  destinationType?: DestinationType;
  destinationReasonCode?: string;
  destinationConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  observedKeyword?: string;
  rawText?: string;
  contactObservations?: ContactObservation[];
  observedPhones?: ContactObservation[];
  observedEmails?: ContactObservation[];
  // Compatibility aliases
  advertiserName?: string;
  pageUrl?: string;
  pageId?: string;
  adText?: string;
  callToAction?: string;
}

export interface ExtensionLead {
  id: string;
  name: string;
  canonicalName: string;
  canonicalKey?: string;
  facebookPageName: string;
  facebookPageUrl?: string;
  facebookPageState: 'found' | 'not_found' | 'unknown';
  destinationUrl?: string;
  destinationDomain?: string;
  websiteState: 'found' | 'not_found' | 'unknown';
  activeAdCount: number;
  adCount?: number;
  adLibraryIds: string[];
  activeAdLibraryIds?: string[];
  adLibraryUrl?: string;
  matchedKeywords: string[];
  matchedQueries?: string[];
  locationCode: string;
  locationName: string;
  status: 'QUALIFIED' | 'REVIEW_REQUIRED' | 'NEEDS_DATA';
  qualificationFailedGates?: string[];
  qualificationReasons?: string[];
  discoveredAt: string;
  sampleCopy?: string;
  sampleCta?: string;
  // Ad-level CTA & Destination Intelligence (Phase 0.4)
  adEvidence?: AdLevelEvidence[];
  observedCtaTexts?: string[];
  observedCtaTypes?: CtaType[];
  observedDestinationTypes?: DestinationType[];
  primaryCtaType?: CtaType;
  primaryDestinationType?: DestinationType;
  destinationReasonCode?: string;
  destinationConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  // Geographic Qualification (v1.7.5 Hardening)
  targetCountryCode?: string;
  businessCountryCode?: string;
  geographicClassification?: GeographicClassification;
  businessLocationConfidence?: LocationConfidence;
  businessLocationEvidence?: string[];
  businessLocationReason?: string;
  businessLocationReasonCode?: string;
  // Relevance evaluation fields
  relevanceScore?: number;
  relevanceDecision?: RelevanceDecision;
  relevanceConfidence?: RelevanceConfidence;
  relevanceReasons?: string[];
  relevanceMatchedTerms?: string[];
  relevanceEvidence?: StructuredEvidence[];
  relevanceStrategyVersion?: number;
  engineVersion?: string;
  presetVersion?: string;
  evidenceCoverage?: EvidenceCoverage;
  evidenceExplanation?: string;
  uniqueEvidenceSignals?: number;
  observedEvidenceOccurrences?: number;
  // Entity Identity & Resolution (v1.1)
  identityConfidence?: IdentityConfidence;
  canonicalPageId?: string;
  canonicalPageSlug?: string;
  observedDomains?: string[];
  observedUrls?: string[];
  aliases?: string[];
  relationshipType?: EntityRelationshipType;
  mergeHistory?: EntityMergeRecord[];
  // Prompt 5: Uncertain Queue, Advertiser Expansion & Creative Signals
  evaluationStatus?: 'RELEVANT' | 'UNCERTAIN' | 'REJECTED';
  uncertainReason?: string;
  missingEvidence?: string[];
  advertiserExpansionStatus?: AdvertiserExpansionStatus;
  expansionProvenance?: AdvertiserExpansionProvenance[];
  creativeSignals?: StructuredCreativeSignal[];
  // Prompt 6: Website Deep Verification
  websiteVerificationStatus?: WebsiteVerificationStatus;
  websiteVerification?: WebsiteVerificationRecord;
  // Phase 7: Contact Data Quality & Evidence Management
  businessPhone?: string;
  businessEmail?: string;
  phones?: string[];
  emails?: string[];
  contactProfile?: ContactEntityProfile;
  contactQualityState?: ContactQualityState;
  contactObservations?: ContactObservation[];
  // View model and legacy convenience aliases
  leadId?: string;
  advertiserName?: string;
  // Phase 8: Lead Scoring & Prioritization
  leadScore?: number;
  normalizedScore?: number;
  prioritizationTier?: PrioritizationTier;
  scoreConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  scoreBreakdown?: LeadScoreBreakdown;
  scoreModelVersion?: string;
  scoreExplanation?: string;
  ctaTypes?: CtaType[];
  destinationTypes?: DestinationType[];
  ctaType?: CtaType;
  destinationType?: DestinationType;
  historicalNames?: Array<{ name: string; observedAt?: string; sourceTokenId?: string }>;
}

export type GeographicClassification =
  | 'LOCAL_VERIFIED'
  | 'LOCAL_PROBABLE'
  | 'FOREIGN_VERIFIED'
  | 'LOCATION_UNKNOWN';

export type LocationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface GeographicEvaluation {
  classification: GeographicClassification;
  targetCountryCode: string;
  businessCountryCode?: string;
  confidence: LocationConfidence;
  evidence: string[];
  reason: string;
  reasonCode?: string;
  isLocal: boolean;
  isForeign: boolean;
  isUnknown: boolean;
}

export type IdentityConfidence = 'STRONG' | 'MODERATE' | 'WEAK' | 'UNRESOLVED' | 'AMBIGUOUS';
export type EntityRelationshipType =
  | 'PARENT_BRAND'
  | 'LOCAL_BRANCH'
  | 'INDEPENDENT_BUSINESS'
  | 'UNRESOLVED_RELATIONSHIP';

export interface EntityMergeRecord {
  timestamp: string;
  mergeReason: string;
  sourceLibraryId?: string;
  sourceQuery?: string;
  confidence: IdentityConfidence;
}

export interface ExtensionResearchRun {
  runId: string;
  researchName: string;
  mode: ResearchMode;
  presetId?: string;
  presetName?: string;
  keywords: string[];
  countryCode: string;
  locationName: string;
  // Geographic and qualification settings (Phase 2, 3, 4, 5)
  strictLocalMode?: boolean;
  allowProbableLocal?: boolean;
  requiredCtaTypes?: string[];
  requiredDestinationTypes?: string[];
  websiteRequirement?: 'WITH_WEBSITE' | 'WITHOUT_WEBSITE' | 'BOTH' | 'ANY' | 'WITH' | 'WITHOUT';
  researchIntent?: any;
  // Auto-Discovery fields (Phase 1)
  researchMode?: 'AUTO_DISCOVERY';
  maxFinalUniqueRelevantLeads?: number;
  // Legacy backward-compatibility metadata
  maxResults?: number;
  targetLeadCount?: number;
  status: JobStatus;
  stopReason?: string;
  challengeReason?: string;
  leads: ExtensionLead[];
  rejectedLeadsCount?: number;
  uncertainLeadsCount?: number;
  relevanceStrategyVersion?: number;
  engineVersion?: string;
  counters?: RunCounters;
  logs: Array<{
    timestamp: string;
    message: string;
    stage: string;
  }>;
  startedAt: string;
  completedAt?: string;
  lastUpdatedAt: string;
  schemaVersion: number;
  totalAdsInspected: number;
  allCandidates?: ScrapedAdCandidate[];
  activeKeywordIndex?: number;
  currentKeyword?: string;
  keywordsCompleted?: number;
  totalKeywords?: number;
  entitiesEvaluated?: number;
  lastCheckpointBatch?: number;
  frontier?: KeywordFrontierState;
  queryFrontier?: QueryFrontierState;
  plannedQueries?: PlannedQuery[];
  activeQueryIndex?: number;
  warningMessages?: string[];
  hasWarnings?: boolean;
}

export interface StartResearchPayload {
  mode: ResearchMode;
  presetId?: string;
  presetName?: string;
  keywords: string[];
  countryCode: string;
  locationName: string;
  researchName?: string;
  // Auto-Discovery fields (Phase 1)
  researchMode?: 'AUTO_DISCOVERY';
  maxFinalUniqueRelevantLeads?: number;
  // Legacy backward-compatibility
  maxResults?: number;
  // Geographic qualification mode
  strictLocalMode?: boolean;
  allowProbableLocal?: boolean;
  requiredCtaTypes?: string[];
  requiredDestinationTypes?: string[];
  websiteRequirement?: 'WITH_WEBSITE' | 'WITHOUT_WEBSITE' | 'BOTH' | 'ANY' | 'WITH' | 'WITHOUT';
}

export interface ExtensionMessage {
  type:
    | 'START_RESEARCH'
    | 'STOP_RESEARCH'
    | 'CANCEL_RESEARCH'
    | 'RESUME_RESEARCH'
    | 'GET_STATE'
    | 'GET_HISTORY'
    | 'CLEAR_HISTORY'
    | 'GET_ALL_LEADS_FOR_EXPORT'
    | 'RESEARCH_PROGRESS'
    | 'RESEARCH_COMPLETED'
    | 'SCAN_AND_EXTRACT'
    | 'CANDIDATES_COLLECTED'
    | 'CHALLENGE_DETECTED'
    | 'CONTENT_SCRIPT_READY'
    | 'VERIFY_WEBSITE'
    | 'GET_WEBSITE_VERIFICATION'
    | 'EVALUATE_BUSINESS_QUALIFICATION'
    | 'ASSEMBLE_CANONICAL_LEAD'
    | 'RECOVER_RUN';
  payload?: any;
}

// ==========================================
// Prompt 6: Website Deep Verification Engine
// ==========================================

export type WebsiteVerificationStatus =
  | 'NOT_VERIFIED'
  | 'VERIFYING'
  | 'VERIFIED_BUSINESS_WEBSITE'
  | 'LIKELY_BUSINESS_WEBSITE'
  | 'UNCERTAIN_WEBSITE'
  | 'NOT_A_BUSINESS_SITE'
  | 'INVALID'
  | 'BLOCKED'
  | 'DISABLED'
  | 'NO_WEBSITE';

export type WebsiteIdentityMatchLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY' | 'UNKNOWN';
export type WebsiteCategoryMatchLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'CONTRADICTORY' | 'UNKNOWN';

export type WebsiteCommercialSignalCode =
  | 'WEBSITE_PRODUCT_SIGNAL'
  | 'WEBSITE_SERVICE_SIGNAL'
  | 'WEBSITE_PRICE_SIGNAL'
  | 'WEBSITE_ECOMMERCE_SIGNAL'
  | 'WEBSITE_BOOKING_SIGNAL'
  | 'WEBSITE_CONTACT_SIGNAL'
  | 'WEBSITE_LOCATION_SIGNAL'
  | 'WEBSITE_SHOWROOM_SIGNAL'
  | 'WEBSITE_DELIVERY_SIGNAL'
  | 'WEBSITE_WARRANTY_SIGNAL';

export type WebsiteNegativeSignalCode =
  | 'PARKED_DOMAIN'
  | 'DOMAIN_FOR_SALE'
  | 'EMPTY_SITE'
  | 'GENERIC_DIRECTORY'
  | 'JOB_PORTAL'
  | 'NEWS_ONLY'
  | 'PERSONAL_BLOG'
  | 'UNRELATED_CATEGORY'
  | 'SOCIAL_ONLY_REDIRECT'
  | 'MARKETPLACE_ONLY'
  | 'BROKEN_SITE';

export interface WebsiteContactSignal {
  type: 'phone' | 'email' | 'address' | 'city' | 'country' | 'contactPage' | 'businessHours';
  value: string;
}

export interface WebsiteVerificationRecord {
  leadId: string;
  canonicalName: string;
  originalUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  finalOrigin: string;
  hostname: string;
  status: WebsiteVerificationStatus;
  identityMatch: WebsiteIdentityMatchLevel;
  categoryMatch: WebsiteCategoryMatchLevel;
  commercialSignals: WebsiteCommercialSignalCode[];
  negativeSignals: WebsiteNegativeSignalCode[];
  evidence: StructuredEvidence[];
  pagesVisited: string[];
  contactSignals: WebsiteContactSignal[];
  locationSignals: string[];
  verifiedAt: string;
  durationMs: number;
  blockedReason?: string;
  errorCode?: string;
}

// ==========================================
// Meta Ad Library Hardened Extraction Types
// ==========================================

export type CardValidationOutcome =
  | 'VALID_CANDIDATE'
  | 'MISSING_IDENTIFIER'
  | 'AMBIGUOUS_CANDIDATE'
  | 'INVALID_CONTAINER'
  | 'DUPLICATE_CANDIDATE'
  | 'PARSING_FAILED';

export interface AdExtractionDiagnostics {
  cardsExamined: number;
  identifierCandidatesFound: number;
  validCardsAccepted: number;
  cardsRejectedMissingId: number;
  duplicateCardsIgnored: number;
  extractionDurationMs: number;
  scrollIteration?: number;
  relevantMutationsObserved?: number;
  details?: Array<{
    libraryId?: string;
    outcome: CardValidationOutcome;
    reason?: string;
  }>;
}

export type ExtractionResultStatus =
  | 'RESULTS_FOUND'
  | 'NO_NEW_RESULTS_OBSERVED'
  | 'END_OF_RESULTS'
  | 'CHALLENGED'
  | 'RATE_LIMITED'
  | 'TAB_TIMEOUT'
  | 'CANCELLED'
  | 'EXTRACTION_ERROR';

export interface AdExtractionResult {
  candidates: ScrapedAdCandidate[];
  diagnostics: AdExtractionDiagnostics;
  status: ExtractionResultStatus;
  atBottom?: boolean;
}
