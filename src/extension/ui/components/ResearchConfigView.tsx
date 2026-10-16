/**
 * LeadNoria — Phase 25: Unified Lead Intelligence UI & Research Workflow Integration
 * Research Configuration View Component
 * 
 * Strict Invariants:
 * - Simple, human-understandable controls only
 * - Source: [ From Meta Ad Library ] (approved production source)
 * - Geographic Scope (Country / Region / City)
 * - Category & Query Scope (Industry Preset or Custom Keywords)
 * - Max Candidates Limit
 * - No internal adapter names, provenance flags, execution mode switches, search-unit IDs, retry counters
 * - Review Research Plan before execution
 */

import React, { useState } from 'react';
import { SourceType, ExecutionMode } from '../../pipeline/pipelineTypes.ts';
import { SourceSelector } from './SourceSelector.tsx';
import { RESEARCH_PRESETS } from '../../../data/presetCatalogue.ts';
import { META_AD_LIBRARY_LOCATIONS } from '../../../data/locationCatalogue.ts';

interface ResearchConfigViewProps {
  selectedSource: SourceType;
  onSelectSource: (source: SourceType) => void;
  onOpenPlanReview: (config: {
    sourceType: SourceType;
    executionMode: ExecutionMode;
    keywords: string[];
    countryCode: string;
    locationName?: string;
    maxCandidates: number;
    presetName?: string;
    strictLocal?: boolean;
    requiredCta?: string;
    requiredDestination?: string;
    websiteRequirement?: string;
  }) => void;
  onNavigateToImport?: () => void;
  disabled?: boolean;
}

export const ResearchConfigView: React.FC<ResearchConfigViewProps> = ({
  selectedSource,
  onSelectSource,
  onOpenPlanReview,
  onNavigateToImport,
  disabled = false
}) => {
  const [modeType, setModeType] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [presetId, setPresetId] = useState<string>(RESEARCH_PRESETS[0]?.preset_id || '');
  const [customKeywords, setCustomKeywords] = useState<string>('Furniture, Home Decor');
  const [countryCode, setCountryCode] = useState<string>('BD');
  const [maxCandidates, setMaxCandidates] = useState<number>(200);
  const [strictLocal, setStrictLocal] = useState<boolean>(true);
  const [requiredCta, setRequiredCta] = useState<string>('ANY');
  const [requiredDestination, setRequiredDestination] = useState<string>('ANY');
  const [websiteRequirement, setWebsiteRequirement] = useState<string>('ANY');

  const selectedPreset = RESEARCH_PRESETS.find(p => p.preset_id === presetId) || RESEARCH_PRESETS[0];

  const handleReviewClick = () => {
    let keywords: string[] = [];
    let presetName: string | undefined;

    if (modeType === 'PRESET' && selectedPreset) {
      keywords = selectedPreset.primary_keywords;
      presetName = selectedPreset.name;
    } else {
      keywords = customKeywords
        .split(/[,;\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }

    const selectedLoc = META_AD_LIBRARY_LOCATIONS.find(l => l.locationCode === countryCode);

    onOpenPlanReview({
      sourceType: selectedSource,
      executionMode: 'LIVE',
      keywords,
      countryCode,
      locationName: selectedLoc?.displayName || countryCode,
      maxCandidates,
      presetName,
      strictLocal,
      requiredCta: requiredCta !== 'ANY' ? requiredCta : undefined,
      requiredDestination: (requiredDestination === 'APP_STORE' ? 'APP' : requiredDestination) !== 'ANY'
        ? (requiredDestination === 'APP_STORE' ? 'APP' : requiredDestination)
        : undefined,
      websiteRequirement: websiteRequirement !== 'ANY' ? websiteRequirement : undefined
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {/* 1. Source Selector (Approved Production Source) */}
      <SourceSelector
        selectedSource={selectedSource}
        onSelectSource={onSelectSource}
        disabled={disabled}
      />

      {/* 2. Geographic Scope */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col gap-2">
        <label htmlFor="geo-country-select" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Geographic Scope
        </label>
        <select
          id="geo-country-select"
          value={countryCode}
          onChange={e => setCountryCode(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          {META_AD_LIBRARY_LOCATIONS.map(loc => (
            <option key={loc.locationCode} value={loc.locationCode}>
              {loc.displayName} ({loc.locationCode})
            </option>
          ))}
        </select>
      </div>

      {/* 3. Category / Query Scope */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Category &amp; Query Scope
          </span>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => setModeType('PRESET')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                modeType === 'PRESET' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Industry Preset
            </button>
            <button
              type="button"
              onClick={() => setModeType('CUSTOM')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                modeType === 'CUSTOM' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Keywords
            </button>
          </div>
        </div>

        {modeType === 'PRESET' ? (
          <div>
            <select
              value={presetId}
              onChange={e => setPresetId(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400 mb-1"
              aria-label="Select industry research preset"
            >
              {RESEARCH_PRESETS.map(p => (
                <option key={p.preset_id} value={p.preset_id}>
                  {p.name} ({p.industry})
                </option>
              ))}
            </select>
            {selectedPreset && (
              <p className="text-[11px] text-slate-400">
                Keywords: <span className="text-slate-300 font-mono">{selectedPreset.primary_keywords.join(', ')}</span>
              </p>
            )}
          </div>
        ) : (
          <div>
            <textarea
              rows={2}
              value={customKeywords}
              onChange={e => setCustomKeywords(e.target.value)}
              disabled={disabled}
              placeholder="Enter comma-separated keywords (e.g. Roofing, Gutter Repair)"
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-label="Custom research keywords"
            />
            <p className="text-[10px] text-slate-500">Separate multiple search terms with commas or newlines.</p>
          </div>
        )}
      </div>

      {/* 4. Qualification Criteria & Filters */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Qualification Rules
        </span>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={strictLocal}
            onChange={e => setStrictLocal(e.target.checked)}
            disabled={disabled}
            className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
          />
          <span>
            <strong className="text-slate-200">Strict-Local Verification</strong> (Foreign &amp; unknown locations fail gate)
          </span>
        </label>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label htmlFor="required-cta-select" className="text-[10px] uppercase text-slate-400 block mb-0.5">
              Required CTA
            </label>
            <select
              id="required-cta-select"
              value={requiredCta}
              onChange={e => setRequiredCta(e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="ANY">Any Observed CTA</option>
              <option value="LEARN_MORE">Learn More</option>
              <option value="SHOP_NOW">Shop Now</option>
              <option value="SIGN_UP">Sign Up</option>
              <option value="CONTACT_US">Contact Us</option>
              <option value="SEND_MESSAGE">Send Message</option>
              <option value="CALL_NOW">Call Now</option>
              <option value="DOWNLOAD">Download</option>
              <option value="GET_QUOTE">Get Quote</option>
              <option value="OTHER">Other CTA</option>
            </select>
          </div>
          <div>
            <label htmlFor="required-dest-select" className="text-[10px] uppercase text-slate-400 block mb-0.5">
              Required Destination
            </label>
            <select
              id="required-dest-select"
              value={requiredDestination}
              onChange={e => setRequiredDestination(e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="ANY">Any Destination</option>
              <option value="EXTERNAL_WEBSITE">External Website</option>
              <option value="INSTANT_FORM">Meta Instant Form</option>
              <option value="MESSAGING">Messaging</option>
              <option value="CALL">Phone Call</option>
              <option value="APP">Mobile App / App Store</option>
              <option value="OTHER">Other Destination</option>
            </select>
          </div>
          <div>
            <label htmlFor="required-website-select" className="text-[10px] uppercase text-slate-400 block mb-0.5">
              Website Requirement
            </label>
            <select
              id="required-website-select"
              value={websiteRequirement}
              onChange={e => setWebsiteRequirement(e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="ANY">Any Website Status</option>
              <option value="WITH_WEBSITE">Must Have Website</option>
              <option value="WITHOUT_WEBSITE">Without Website (Social Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Research Scope Limit */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex flex-col gap-2">
        <label htmlFor="max-candidates-input" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Max Leads Target
        </label>
        <div className="flex items-center gap-3">
          <input
            id="max-candidates-input"
            type="number"
            min={10}
            max={1000}
            value={maxCandidates}
            onChange={e => setMaxCandidates(Math.max(10, Math.min(1000, parseInt(e.target.value) || 100)))}
            disabled={disabled}
            className="w-32 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <span className="text-[11px] text-slate-400">Target unique relevant business leads to discover.</span>
        </div>
      </div>

      {/* 5. Review & Launch Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleReviewClick}
        className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>📋</span> Review Research Plan →
      </button>

      {/* Manual Import Signals Shortcut */}
      {onNavigateToImport && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onNavigateToImport}
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>📥</span> Or import ad copy, URLs, or CSV manually →
          </button>
        </div>
      )}
    </div>
  );
};
