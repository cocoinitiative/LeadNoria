/**
 * LeadNoria — Phase 15 & Phase 25: UI/UX Integration & Unified Lead Intelligence
 * Scalable Results List View Component
 * 
 * Strict Invariants:
 * - Deterministic sorting and filtering
 * - Preserves authoritative states (SKIPPED != NOT_QUALIFIED, BLOCKED != NOT_FOUND)
 * - Bulk selection does NOT imply bulk export eligibility (policy firewall is separate)
 * - Selection operates on canonical entity IDs
 * - Progressive disclosure: compact row with click-to-expand details
 * - Displays separate source badges, quality metrics, data signals, and friendly human labels
 */

import React, { useState, useMemo } from 'react';
import { ResultRowViewModel } from '../types.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { toFriendlyStatus } from '../humanLabels.ts';
import { getSafeExternalUrl } from '../security.ts';
import { writeClipboardText } from '../../clipboard/index.ts';
import { leadResultsToSheets, LEAD_EXPORT_COLUMNS, type LeadExportColumn } from '../../clipboard/leadSheets.ts';
import { isNewToSavedLists } from '../../localBusinessHistory.ts';

const EMPTY_BUSINESS_HISTORY: ReadonlySet<string> = new Set();

export type SortOption =
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'LOCATION'
  | 'QUALIFICATION'
  | 'COMPLETENESS'
  | 'CONTACT_COMPLETENESS'
  | 'LAST_OBSERVED'
  | 'SOURCE';

interface ResultsTableViewProps {
  results: ResultRowViewModel[];
  selectedRecordIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onInspectRecord: (recordId: string) => void;
  onOpenExportModal: () => void;
  onDownloadCsv?: (recordIds: string[], columns?: LeadExportColumn[]) => void;
  initialWebsitePreference?: string;
  seenBusinessKeys?: ReadonlySet<string>;
}

export const ResultsTableView: React.FC<ResultsTableViewProps> = ({
  results,
  selectedRecordIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onInspectRecord,
  onOpenExportModal,
  onDownloadCsv,
  initialWebsitePreference = 'ANY',
  seenBusinessKeys = EMPTY_BUSINESS_HISTORY
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [websitePreference, setWebsitePreference] = useState(initialWebsitePreference);
  const [newBusinessesOnly, setNewBusinessesOnly] = useState(false);
  const [customColumns, setCustomColumns] = useState(false);
  const [exportColumns, setExportColumns] = useState<LeadExportColumn[]>([...LEAD_EXPORT_COLUMNS]);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [qualificationFilter, setQualificationFilter] = useState<string>('ALL');
  const [targetCountryFilter, setTargetCountryFilter] = useState<string>('ALL');
  const [geoClassificationFilter, setGeoClassificationFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [ctaTypeFilter, setCtaTypeFilter] = useState<string>('ALL');
  const [destinationTypeFilter, setDestinationTypeFilter] = useState<string>('ALL');
  const [conflictFilter, setConflictFilter] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');
  const [freshnessFilter, setFreshnessFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [requirePhone, setRequirePhone] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requireWebsite, setRequireWebsite] = useState(false);
  const [requirePerson, setRequirePerson] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('NAME_ASC');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Copy All State
  const [isCopying, setIsCopying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Derive unique options for filter dropdowns
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort();
  }, [results]);

  const availableTargetCountries = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.targetCountryCode) set.add(r.targetCountryCode);
    }
    return Array.from(set).sort();
  }, [results]);

  const availableCtaTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.ctaType && r.ctaType !== 'UNKNOWN') set.add(r.ctaType);
    }
    return Array.from(set).sort();
  }, [results]);

  const availableDestinationTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) {
      if (r.destinationType && r.destinationType !== 'UNKNOWN') set.add(r.destinationType);
    }
    return Array.from(set).sort();
  }, [results]);

  const hasActiveFilters = Boolean(
    newBusinessesOnly || searchTerm.trim() !== '' ||
    sourceFilter !== 'ALL' ||
    qualificationFilter !== 'ALL' ||
    targetCountryFilter !== 'ALL' ||
    geoClassificationFilter !== 'ALL' ||
    tierFilter !== 'ALL' ||
    ctaTypeFilter !== 'ALL' ||
    destinationTypeFilter !== 'ALL' ||
    conflictFilter !== 'ALL' ||
    minScore !== '' ||
    maxScore !== '' ||
    freshnessFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    requirePhone ||
    requireEmail ||
    requireWebsite ||
    requirePerson
  );

  const handleClearFilters = () => {
    setNewBusinessesOnly(false);
    setSearchTerm('');
    setSourceFilter('ALL');
    setQualificationFilter('ALL');
    setTargetCountryFilter('ALL');
    setGeoClassificationFilter('ALL');
    setTierFilter('ALL');
    setCtaTypeFilter('ALL');
    setDestinationTypeFilter('ALL');
    setConflictFilter('ALL');
    setMinScore('');
    setMaxScore('');
    setFreshnessFilter('ALL');
    setCategoryFilter('ALL');
    setRequirePhone(false);
    setRequireEmail(false);
    setRequireWebsite(false);
    setRequirePerson(false);
    setPage(1);
  };

  // Filter & Search Logic
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (newBusinessesOnly && !isNewToSavedLists(r.canonicalRecord || r, seenBusinessKeys)) return false;
      if ((websitePreference === 'WITH_WEBSITE' || websitePreference === 'WITH') && !r.websiteUrl) return false;
      if ((websitePreference === 'WITHOUT_OBSERVED_WEBSITE' || websitePreference === 'WITHOUT_WEBSITE' || websitePreference === 'WITHOUT') && r.websiteUrl) return false;
      // Local text search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchesName = r.displayName.toLowerCase().includes(q);
        const matchesPhone = r.contactSummary.phoneText?.toLowerCase().includes(q);
        const matchesEmail = r.contactSummary.emailText?.toLowerCase().includes(q);
        const matchesWebsite = r.websiteUrl?.toLowerCase().includes(q);
        const matchesCategory = r.category?.toLowerCase().includes(q);
        const matchesLocation = r.geographicContext?.toLowerCase().includes(q);
        const matchesPeople = (r.canonicalRecord?.people?.publicPeople || []).some((p: any) =>
          p.name?.toLowerCase().includes(q) || p.canonicalName?.toLowerCase().includes(q)
        );

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesWebsite && !matchesCategory && !matchesLocation && !matchesPeople) {
          return false;
        }
      }

      // Source filter
      if (sourceFilter !== 'ALL') {
        const hasSource = r.sourceBadges
          ? r.sourceBadges.some(b => b.sourceType === sourceFilter)
          : r.primarySource === sourceFilter;
        if (!hasSource) return false;
      }

      // Qualification filter
      if (qualificationFilter !== 'ALL') {
        if (qualificationFilter === 'QUALIFIED' && r.qualificationState !== 'QUALIFIED') return false;
        if (qualificationFilter === 'REVIEW_REQUIRED' && r.qualificationState !== 'REVIEW_REQUIRED' && r.qualificationState !== 'UNCERTAIN') return false;
        if (qualificationFilter === 'NOT_QUALIFIED' && r.qualificationState !== 'NOT_QUALIFIED') return false;
        if (qualificationFilter === 'BLOCKED' && r.qualificationState !== 'BLOCKED') return false;
        if (qualificationFilter === 'UNASSESSED' && r.qualificationState !== 'UNASSESSED') return false;
      }

      // Target country filter
      if (targetCountryFilter !== 'ALL' && r.targetCountryCode !== targetCountryFilter) {
        return false;
      }

      // Geographic classification filter
      if (geoClassificationFilter !== 'ALL') {
        const geo = r.geographicClassification || (r.businessCountryCode ? (r.businessCountryCode === r.targetCountryCode ? 'LOCAL_PROBABLE' : 'FOREIGN_VERIFIED') : 'LOCATION_UNKNOWN');
        if (geo !== geoClassificationFilter) return false;
      }

      // Prioritization Tier filter
      if (tierFilter !== 'ALL') {
        const t = r.prioritizationTier || r.canonicalRecord?.prioritizationTier || 'UNRANKED';
        if (t !== tierFilter) return false;
      }

      // Score range filter
      const score = r.qualificationScore !== undefined ? r.qualificationScore : r.canonicalRecord?.leadScore;
      if (minScore !== '' && !isNaN(Number(minScore))) {
        if (score === undefined || score < Number(minScore)) return false;
      }
      if (maxScore !== '' && !isNaN(Number(maxScore))) {
        if (score === undefined || score > Number(maxScore)) return false;
      }

      // CTA type filter
      if (ctaTypeFilter !== 'ALL') {
        const cta = r.ctaType || r.canonicalRecord?.primaryCtaType || 'UNKNOWN';
        if (cta !== ctaTypeFilter) return false;
      }

      // Destination type filter
      if (destinationTypeFilter !== 'ALL') {
        const dest = r.destinationType || r.canonicalRecord?.primaryDestinationType || 'UNKNOWN';
        if (dest !== destinationTypeFilter) return false;
      }

      // Contact conflict filter
      if (conflictFilter === 'CONFLICT_ONLY') {
        const hasConflict = r.phoneConflictState === 'PHONE_CONFLICT' ||
          r.emailConflictState === 'EMAIL_CONFLICT' ||
          r.canonicalRecord?.contactProfile?.phoneConflict ||
          r.canonicalRecord?.contactProfile?.emailConflict;
        if (!hasConflict) return false;
      } else if (conflictFilter === 'NO_CONFLICT') {
        const hasConflict = r.phoneConflictState === 'PHONE_CONFLICT' ||
          r.emailConflictState === 'EMAIL_CONFLICT' ||
          r.canonicalRecord?.contactProfile?.phoneConflict ||
          r.canonicalRecord?.contactProfile?.emailConflict;
        if (hasConflict) return false;
      }

      // Freshness filter
      if (freshnessFilter !== 'ALL') {
        const freshState = r.dataSignals?.freshness || 'UNKNOWN';
        if (freshState !== freshnessFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) {
        return false;
      }

      // Signal filters
      if (requirePhone && !r.contactSummary.hasPhone) return false;
      if (requireEmail && !r.contactSummary.hasEmail) return false;
      if (requireWebsite && !r.dataSignals?.websiteVerified && !r.websiteUrl && r.websiteState !== 'found' && r.websiteState !== 'VERIFIED_BUSINESS_WEBSITE') return false;
      if (requirePerson && !r.dataSignals?.publicPersonAvailable) return false;

      return true;
    });
  }, [
    results,
    searchTerm,
    sourceFilter,
    qualificationFilter,
    targetCountryFilter,
    geoClassificationFilter,
    tierFilter,
    ctaTypeFilter,
    destinationTypeFilter,
    conflictFilter,
    minScore,
    maxScore,
    freshnessFilter,
    categoryFilter,
    requirePhone,
    requireEmail,
    requireWebsite, websitePreference, newBusinessesOnly, seenBusinessKeys,
    requirePerson
  ]);

  // Deterministic Sorting
  const sortedResults = useMemo(() => {
    const list = [...filteredResults];
    list.sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case 'NAME_ASC':
          diff = a.displayName.localeCompare(b.displayName);
          break;
        case 'NAME_DESC':
          diff = b.displayName.localeCompare(a.displayName);
          break;
        case 'LOCATION':
          diff = (a.geographicContext || '').localeCompare(b.geographicContext || '');
          break;
        case 'QUALIFICATION':
          diff = a.qualificationState.localeCompare(b.qualificationState);
          break;
        case 'COMPLETENESS': {
          const compA = a.qualityMetrics?.completenessPercent || 0;
          const compB = b.qualityMetrics?.completenessPercent || 0;
          diff = compB - compA;
          break;
        }
        case 'CONTACT_COMPLETENESS': {
          const compA = a.qualityMetrics?.contactCompletenessPercent || 0;
          const compB = b.qualityMetrics?.contactCompletenessPercent || 0;
          diff = compB - compA;
          break;
        }
        case 'LAST_OBSERVED': {
          const tA = a.lastObservedText ? new Date(a.lastObservedText).getTime() : 0;
          const tB = b.lastObservedText ? new Date(b.lastObservedText).getTime() : 0;
          diff = tB - tA;
          break;
        }
        case 'SOURCE':
          diff = a.primarySource.localeCompare(b.primarySource);
          break;
        default:
          diff = 0;
      }
      // Always tie-break deterministically using canonical entityId or recordId
      return diff !== 0 ? diff : (a.entityId || a.recordId).localeCompare(b.entityId || b.recordId);
    });
    return list;
  }, [filteredResults, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedResults.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedResults.slice(start, start + PAGE_SIZE);
  }, [sortedResults, currentPage]);
  const csvRows = sortedResults.filter(row => row.isExportable && !row.isRestricted &&
    (selectedRecordIds.size === 0 || selectedRecordIds.has(row.recordId) || selectedRecordIds.has(row.entityId)));

  const allFilteredSelected = paginatedResults.length > 0 &&
    paginatedResults.every(r => selectedRecordIds.has(r.entityId) || selectedRecordIds.has(r.recordId));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      onClearSelection();
    } else {
      // Use entityId for selection, fallback to recordId
      onSelectAll(paginatedResults.map(r => r.entityId || r.recordId));
    }
  };

  // Copy All Handler
  const handleCopyAll = async () => {
    if (csvRows.length === 0 || isCopying) return;
    setIsCopying(true);
    setCopyFeedback(null);

    try {
      // Consume active structured results through Meta clipboard projection
      const tsv = leadResultsToSheets(csvRows, customColumns ? exportColumns : undefined);
      const result = await writeClipboardText(tsv);

      if (result.success) {
        setCopyFeedback({
          type: 'success',
          message: `${csvRows.length} leads copied. Paste into Google Sheets.`
        });
        setTimeout(() => {
          setCopyFeedback(prev => prev?.type === 'success' ? null : prev);
        }, 3000);
      } else {
        setCopyFeedback({
          type: 'error',
          message: 'Could not copy results to clipboard.'
        });
      }
    } catch (_err) {
      setCopyFeedback({
        type: 'error',
        message: 'Could not copy results to clipboard.'
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls Bar: Search, Filters, Export */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col gap-2.5">
        <label className="text-xs text-slate-300">Show leads
          <select aria-label="Website filter" value={websitePreference} onChange={e => { setWebsitePreference(e.target.value); setPage(1); }} className="ml-2 p-2 bg-slate-950 border border-slate-700 rounded">
            <option value="ANY">All leads</option><option value="WITH_WEBSITE">With a website</option><option value="WITHOUT_OBSERVED_WEBSITE">No website seen</option>
          </select>
        </label>
        <label className="text-xs text-slate-300 flex items-center gap-2"><input type="checkbox" checked={newBusinessesOnly} onChange={e => { setNewBusinessesOnly(e.target.checked); setPage(1); }} />Only new businesses in my saved lists</label>
        {newBusinessesOnly && <p className="text-xs text-slate-400">Compared with older lists on this device. Businesses without a usable identity are left out.</p>}
        {websitePreference === 'WITHOUT_OBSERVED_WEBSITE' && <p className="text-xs text-slate-400">No website was visible in the ad. The business may still have one.</p>}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-2.5 text-xs text-slate-500" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search eligible businesses, emails, phones, domains, categories..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label="Search results"
            />
          </div>

          {/* Copy All Button */}
          <button
            type="button"
            id="meta-copy-all-btn"
            onClick={handleCopyAll}
            disabled={csvRows.length === 0 || isCopying || (customColumns && exportColumns.length === 0)}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer ${
              csvRows.length > 0 && !isCopying
                ? 'bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700'
                : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
            }`}
            aria-label={`Copy ${csvRows.length} leads for Google Sheets`}
          >
            <span>📋</span> {isCopying ? 'Copying...' : `Copy for Sheets (${csvRows.length})`}
          </button>

          {onDownloadCsv && <button type="button" disabled={csvRows.length === 0 || (customColumns && exportColumns.length === 0)}
            onClick={() => onDownloadCsv(csvRows.map(row => row.recordId), customColumns ? exportColumns : undefined)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-sky-700 text-white disabled:opacity-50">
            Download CSV ({csvRows.length})
          </button>}
          {/* Export Button */}
          <details className="text-xs text-slate-400"><summary className="cursor-pointer">Export options</summary>
          <label className="flex items-center gap-2 my-2"><input type="checkbox" checked={customColumns} onChange={e => setCustomColumns(e.target.checked)} />Choose columns for CSV and Sheets</label>
          {customColumns && <fieldset className="grid grid-cols-2 gap-2 my-2"><legend>Export columns</legend>{LEAD_EXPORT_COLUMNS.map(column => <label key={column} className="flex gap-2 items-center"><input type="checkbox" checked={exportColumns.includes(column)} onChange={e => setExportColumns(columns => e.target.checked ? LEAD_EXPORT_COLUMNS.filter(value => value === column || columns.includes(value)) : columns.filter(value => value !== column))} />{column}</label>)}{!exportColumns.length && <p role="alert">Choose at least one column.</p>}</fieldset>}
          <button
            type="button"
            onClick={onOpenExportModal}
            disabled={results.length === 0}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer ${
              results.length > 0
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <span>⭳</span> Export ({selectedRecordIds.size > 0 ? selectedRecordIds.size : results.length})
          </button>
          </details>
        </div>

        {/* Copy All Feedback Notification */}
        {copyFeedback && (
          <div
            role="status"
            aria-live="polite"
            className={`px-3 py-1.5 rounded text-xs flex items-center justify-between transition-all ${
              copyFeedback.type === 'success'
                ? 'bg-sky-950/80 border border-sky-800/80 text-sky-200'
                : 'bg-sky-950/80 border border-sky-800/80 text-sky-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>{copyFeedback.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{copyFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setCopyFeedback(null)}
              className="text-slate-400 hover:text-white cursor-pointer ml-2 text-xs"
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        )}

        <details><summary className="text-xs text-slate-300 cursor-pointer">Filter and sort leads</summary>
        {/* Filter & Sort Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Qualification Filter */}
            <select
              value={qualificationFilter}
              onChange={e => { setQualificationFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by qualification status"
            >
              <option value="ALL">All Qualifications</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="REVIEW_REQUIRED">Review Required</option>
              <option value="NOT_QUALIFIED">Does not meet criteria</option>
              <option value="UNCERTAIN">Needs review</option>
              <option value="UNASSESSED">Unassessed</option>
              <option value="BLOCKED">Unavailable</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by source"
            >
              <option value="ALL">All Sources</option>
              <option value="META">Meta</option>
              <option value="WEBSITE">Website</option>
            </select>

            {/* Freshness Filter */}
            <select
              value={freshnessFilter}
              onChange={e => { setFreshnessFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by data freshness"
            >
              <option value="ALL">All Freshness</option>
              <option value="CURRENT">Recently observed</option>
              <option value="STALE">May be outdated</option>
              <option value="UNKNOWN">Not enough info</option>
            </select>

            {/* Geographic Classification Filter */}
            <select
              value={geoClassificationFilter}
              onChange={e => { setGeoClassificationFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by geographic classification"
            >
              <option value="ALL">All Geo Classifications</option>
              <option value="LOCAL_VERIFIED">📍 Local Verified Only</option>
              <option value="FOREIGN_VERIFIED">🌐 Foreign Verified</option>
              <option value="LOCAL_PROBABLE">❓ Local Probable</option>
              <option value="LOCATION_UNKNOWN">❔ Location Unknown</option>
            </select>

            {/* Prioritization Tier Filter */}
            <select
              value={tierFilter}
              onChange={e => { setTierFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by prioritization tier"
            >
              <option value="ALL">All Tiers</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
              <option value="MINIMAL">Minimal Priority</option>
            </select>

            {/* Target Country Filter */}
            {availableTargetCountries.length > 1 && (
              <select
                value={targetCountryFilter}
                onChange={e => { setTargetCountryFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label="Filter by target country"
              >
                <option value="ALL">All Target Countries</option>
                {availableTargetCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* CTA Type Filter */}
            {availableCtaTypes.length > 0 && (
              <select
                value={ctaTypeFilter}
                onChange={e => { setCtaTypeFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label="Filter by CTA type"
              >
                <option value="ALL">All CTAs</option>
                {availableCtaTypes.map(c => (
                  <option key={c} value={c}>{toFriendlyStatus(c)}</option>
                ))}
              </select>
            )}

            {/* Destination Type Filter */}
            {availableDestinationTypes.length > 0 && (
              <select
                value={destinationTypeFilter}
                onChange={e => { setDestinationTypeFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label="Filter by destination type"
              >
                <option value="ALL">All Destinations</option>
                {availableDestinationTypes.map(d => (
                  <option key={d} value={d}>{toFriendlyStatus(d)}</option>
                ))}
              </select>
            )}

            {/* Contact Conflict Filter */}
            <select
              value={conflictFilter}
              onChange={e => { setConflictFilter(e.target.value); setPage(1); }}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
              aria-label="Filter by contact conflict status"
            >
              <option value="ALL">All Contact States</option>
              <option value="NO_CONFLICT">No Conflicts</option>
              <option value="CONFLICT_ONLY">⚠️ Conflicted Contacts Only</option>
            </select>

            {/* Score Range Inputs */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span>Score:</span>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Min"
                value={minScore}
                onChange={e => { setMinScore(e.target.value); setPage(1); }}
                className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label="Minimum lead score"
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Max"
                value={maxScore}
                onChange={e => { setMaxScore(e.target.value); setPage(1); }}
                className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                aria-label="Maximum lead score"
              />
            </div>

            {/* Category Filter */}
            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400 max-w-[140px]"
                aria-label="Filter by business category"
              >
                <option value="ALL">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            {/* Signal Checkboxes */}
            <label className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={e => { setRequirePhone(e.target.checked); setPage(1); }}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              Phone
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requireEmail}
                onChange={e => { setRequireEmail(e.target.checked); setPage(1); }}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              Email
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requireWebsite}
                onChange={e => { setRequireWebsite(e.target.checked); setPage(1); }}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              Website
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requirePerson}
                onChange={e => { setRequirePerson(e.target.checked); setPage(1); }}
                className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              Person
            </label>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2 py-0.5 text-[11px] font-semibold bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-800/80 rounded cursor-pointer transition-colors"
                aria-label="Clear all applied filters"
              >
                ✕ Clear Filters
              </button>
            )}
          </div>

          {/* Sort Selection */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500 text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-400 text-xs"
              aria-label="Sort records"
            >
              <option value="NAME_ASC">Name (A-Z)</option>
              <option value="NAME_DESC">Name (Z-A)</option>
              <option value="LOCATION">Location</option>
              <option value="QUALIFICATION">Qualification</option>
              <option value="COMPLETENESS">Completeness</option>
              <option value="CONTACT_COMPLETENESS">Contact Depth</option>
              <option value="LAST_OBSERVED">Recently Observed</option>
              <option value="SOURCE">Source</option>
            </select>
          </div>
        </div>
        </details>
      </div>

      {/* Selection & Pagination Status Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleToggleSelectAll}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              aria-label="Select all visible records"
            />
            <span className="text-[11px]">Select Visible</span>
          </label>
          <span className="text-[11px] text-slate-500">•</span>
          <span className="text-[11px]">
            Showing <strong>{paginatedResults.length}</strong> of <strong>{sortedResults.length}</strong> matching leads
            {results.length !== sortedResults.length && ` (from ${results.length} unique candidates)`}
          </span>
        </div>

        {selectedRecordIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sky-300 font-semibold text-[11px]">
              {selectedRecordIds.size} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline focus:outline-none cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {paginatedResults.length === 0 && (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-lg">
          <span className="text-2xl block mb-1">🔍</span>
          <p className="text-xs font-semibold text-slate-300 mb-0.5">
            {results.length === 0
              ? 'No Research Results Available'
              : 'No Matching Businesses Found'}
          </p>
          <p className="text-[11px] text-slate-500">
            {results.length === 0
              ? 'Data not available. Start a research run to discover leads.'
              : 'Try adjusting your search terms or relaxing your filter criteria.'}
          </p>
        </div>
      )}

      {/* Results List */}
      {paginatedResults.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs" aria-label="Lead table">
          <thead className="bg-slate-900 text-slate-300"><tr>
            <th className="p-3">Select</th><th className="p-3">Business</th><th className="p-3">Country</th><th className="p-3">Website</th><th className="p-3">Contact</th>
          </tr></thead>
          <tbody>{paginatedResults.map(row => <tr key={row.recordId} className="border-t border-slate-800">
            <td className="p-3"><input type="checkbox" aria-label={`Select ${row.displayName}`} checked={selectedRecordIds.has(row.entityId) || selectedRecordIds.has(row.recordId)} onChange={() => onToggleSelect(row.entityId || row.recordId)} /></td>
            <td className="p-3"><button onClick={() => onInspectRecord(row.recordId)} className="text-sky-300 underline text-left">{row.displayName}</button></td>
            <td className="p-3 text-slate-300">{row.businessCountryCode || 'Unknown'}</td>
            <td className="p-3">{getSafeExternalUrl(row.websiteUrl) ? <a className="text-sky-300 underline" href={getSafeExternalUrl(row.websiteUrl)!} target="_blank" rel="noopener noreferrer">Open website</a> : <span className="text-slate-400">Not seen</span>}</td>
            <td className="p-3 text-slate-300">{row.contactSummary.phoneText || row.contactSummary.emailText || 'Not seen'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <details><summary className="text-xs text-slate-400 cursor-pointer">Detailed lead cards</summary>
      <div className="flex flex-col gap-2" role="list" aria-label="Research results list">
        {paginatedResults.map(r => {
          const isSelected = selectedRecordIds.has(r.entityId) || selectedRecordIds.has(r.recordId);
          const safeWeb = getSafeExternalUrl(r.websiteUrl);

          return (
            <div
              key={r.recordId}
              role="listitem"
              onClick={() => onInspectRecord(r.recordId)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                isSelected
                  ? 'bg-slate-850 border-sky-500/50 shadow-sm'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850/80'
              }`}
            >
              {/* Row Header: Selection, Title, Source Badges, Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={e => e.stopPropagation()}
                    onChange={() => onToggleSelect(r.entityId || r.recordId)}
                    className="mt-1 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 cursor-pointer"
                    aria-label={`Select ${r.displayName}`}
                  />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 leading-tight hover:text-sky-300">
                      {r.displayName}
                    </h4>

                    {/* Metadata line: Category, Location, Source Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-slate-400">
                      {r.category && (
                        <span className="text-slate-300 font-medium">{r.category}</span>
                      )}
                      {r.geographicClassification ? (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className={`text-[10px] font-medium ${
                            r.geographicClassification === 'LOCAL_VERIFIED'
                              ? 'text-sky-400'
                              : (r.geographicClassification === 'FOREIGN_VERIFIED'
                                  ? 'text-sky-400'
                                  : 'text-sky-400')
                          }`}>
                            {r.geographicClassification === 'LOCAL_VERIFIED' ? '📍' : (r.geographicClassification === 'FOREIGN_VERIFIED' ? '🌐' : '❓')} {toFriendlyStatus(r.geographicClassification)}
                            {r.businessCountryCode ? ` [${r.businessCountryCode}]` : ''}
                            {r.targetCountryCode && r.targetCountryCode !== r.businessCountryCode ? ` (Target: ${r.targetCountryCode})` : ''}
                          </span>
                        </>
                      ) : r.geographicContext ? (
                        <>
                          <span className="text-slate-600">•</span>
                          <span>📍 {r.geographicContext}</span>
                        </>
                      ) : null}

                      {/* Source Badges */}
                      <span className="text-slate-600">•</span>
                      <div className="flex items-center gap-1">
                        {r.sourceBadges && r.sourceBadges.length > 0 ? (
                          r.sourceBadges.map((badge, bIdx) => (
                            <span
                              key={bIdx}
                              className={`px-1.5 py-0.2 text-[9px] font-semibold rounded border ${
                                badge.isRestricted
                                  ? 'text-sky-300 bg-sky-950/60 border-sky-500/40'
                                  : (badge.sourceType === 'WEBSITE'
                                      ? 'text-sky-300 bg-sky-950/60 border-sky-500/40'
                                      : 'text-sky-300 bg-sky-950/60 border-sky-500/40')
                              }`}
                            >
                              {badge.label}
                            </span>
                          ))
                        ) : (
                          <span className="font-mono text-slate-500 text-[10px]">{r.primarySource}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  {r.prioritizationTier && r.prioritizationTier !== 'UNRANKED' && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${
                        r.prioritizationTier === 'HIGH'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-500/50'
                          : r.prioritizationTier === 'MEDIUM'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-500/50'
                          : r.prioritizationTier === 'LOW'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-500/50'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                      title={`Prioritization Tier: ${r.prioritizationTier}`}
                    >
                      ★ {r.prioritizationTier}
                    </span>
                  )}
                  {r.qualificationScore !== undefined && (
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded"
                      title={r.scoreExplanation || `Lead Priority Score: ${r.qualificationScore > 1 ? r.qualificationScore : (r.qualificationScore * 100).toFixed(0)}/100`}
                    >
                      Score: {r.qualificationScore > 1 ? `${r.qualificationScore}/100` : `${(r.qualificationScore * 100).toFixed(0)}%`}
                      {r.scoreConfidence && r.scoreConfidence !== 'NONE' && (
                        <span className="text-slate-400 font-sans ml-1 text-[9px]">({r.scoreConfidence})</span>
                      )}
                    </span>
                  )}
                  <StatusBadge
                    status={r.qualificationState}
                    customLabel={r.friendlyQualificationState || toFriendlyStatus(r.qualificationState)}
                    size="sm"
                  />
                  {r.isRestricted && (
                    <span 
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 bg-sky-950/60 border border-sky-500/40 rounded"
                      title="Restricted by source policy (Not exportable or persistable)"
                    >
                      ⊘ RESTRICTED
                    </span>
                  )}
                </div>
              </div>

              {/* Row Body: Contact Summary, Website, Signals */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Phone */}
                  {r.contactSummary.hasPhone ? (
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <span>📞</span> {r.contactSummary.phoneText}
                    </span>
                  ) : (
                    <span className="text-slate-600">No phone</span>
                  )}

                  {/* Email */}
                  {r.contactSummary.hasEmail ? (
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <span>✉</span> {r.contactSummary.emailText}
                    </span>
                  ) : (
                    <span className="text-slate-600">No email</span>
                  )}

                  {/* Website */}
                  {safeWeb ? (
                    <span className="flex items-center gap-1 text-sky-400">
                      <span>🌐</span>
                      <span className="truncate max-w-[150px]">{safeWeb.replace(/^https?:\/\//, '')}</span>
                      {r.dataSignals?.websiteVerified && (
                        <span className="text-sky-400 font-bold" title="Verified business website">✓</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-600">Website not observed</span>
                  )}

                  {/* Public person signal */}
                  {r.dataSignals?.publicPersonAvailable && (
                    <span className="flex items-center gap-0.5 text-slate-300">
                      <span>👤</span> Person
                    </span>
                  )}

                  {/* Freshness signal */}
                  {r.dataSignals?.freshness && (
                    <span className={`px-1.5 py-0.2 text-[9px] rounded font-medium ${
                      r.dataSignals.freshness === 'CURRENT'
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-sky-950/50 text-sky-300 border border-sky-500/30'
                    }`}>
                      {r.dataSignals.freshnessLabel}
                    </span>
                  )}

                  {/* CTA & Destination Signals */}
                  {r.ctaType && r.ctaType !== 'UNKNOWN' && (
                    <span className="px-1.5 py-0.2 text-[9px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                      CTA: {toFriendlyStatus(r.ctaType)}
                    </span>
                  )}
                  {r.destinationType && r.destinationType !== 'UNKNOWN' && (
                    <span className="px-1.5 py-0.2 text-[9px] bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Dest: {toFriendlyStatus(r.destinationType)}
                    </span>
                  )}

                  {/* Contact Conflict Warning */}
                  {(r.phoneConflictState === 'PHONE_CONFLICT' || r.emailConflictState === 'EMAIL_CONFLICT' || r.canonicalRecord?.contactProfile?.phoneConflict || r.canonicalRecord?.contactProfile?.emailConflict) && (
                    <span className="px-1.5 py-0.2 text-[9px] bg-sky-950/60 text-sky-300 border border-sky-500/40 rounded font-semibold" title="Conflicting contact observations recorded across ads">
                      ⚠️ Contact Conflict
                    </span>
                  )}
                </div>

                {/* Quality Summary */}
                {r.qualityMetrics && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 ml-auto">
                    <span>Quality: <strong className="text-slate-300">{r.qualityMetrics.completenessPercent}%</strong></span>
                    {r.qualityMetrics.corroborationCount > 1 && (
                      <span className="text-sky-400 font-semibold">{r.qualityMetrics.corroborationCount} sources</span>
                    )}
                    {r.qualityMetrics.contradictionCount > 0 && (
                      <span className="text-sky-400 font-semibold">⚠️ {r.qualityMetrics.contradictionCount} conflict</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actionable Review Reasons for Review-Required candidates */}
              {r.qualificationState === 'REVIEW_REQUIRED' && (
                <div className="w-full mt-0.5 p-1.5 bg-sky-950/30 border border-sky-500/30 rounded text-[10px] text-sky-200 flex items-start gap-1.5">
                  <span className="text-sky-400 font-bold mt-0.5" aria-hidden="true">⚠</span>
                  <div className="flex-1">
                    <span className="font-semibold text-sky-300 block mb-0.5">Review Required:</span>
                    <span>
                      {r.qualificationReasons && r.qualificationReasons.length > 0
                        ? r.qualificationReasons.join('. ')
                        : 'Qualification reason unavailable; review required.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      </details>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 focus:outline-none"
          >
            ← Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 focus:outline-none"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
