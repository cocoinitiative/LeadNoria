/**
 * LeadNoria Phase 34 — Manual Import Ad Signals Workspace
 *
 * Implements a user-initiated, offline import workflow:
 * - Mode A: Manual Ad Text Paste (from Meta Ad Library)
 * - Mode B: Meta Ad Library URL References (pure local string parsing)
 * - Mode C: User-Supplied CSV Import (RFC 4180 + formula-safe)
 *
 * NON-NEGOTIABLE SAFETY CONSTRAINTS:
 * - Local offline processing only. Zero network requests.
 * - Explicit user initiation before importing.
 * - Clear counts for Accepted, Incomplete, Rejected, and Duplicate records.
 * - Transparent rejection explanations.
 */

import React, { useState, useMemo } from 'react';
import { parseManualAdText, parseMetaAdLibraryUrls, parseUserSuppliedCsv, type ParseResult } from '../../manualImport/importParsers.ts';
import { executeManualImport, type ManualImportSummary } from '../../manualImport/importOrchestrator.ts';
import { META_AD_LIBRARY_LOCATIONS } from '../../../data/locationCatalogue.ts';

export type ImportMode = 'TEXT_PASTE' | 'URL_REFERENCE' | 'CSV_FILE';

interface ManualImportViewProps {
  onImportComplete: (summary: ManualImportSummary) => void;
  onNavigateToResults: () => void;
  disabled?: boolean;
}

export const ManualImportView: React.FC<ManualImportViewProps> = ({
  onImportComplete,
  onNavigateToResults,
  disabled = false
}) => {
  const [mode, setMode] = useState<ImportMode>('TEXT_PASTE');
  const [countryCode, setCountryCode] = useState<string>('BD');
  const [targetKeywords, setTargetKeywords] = useState<string>('Furniture, Commercial, Retail');
  const [strictLocal, setStrictLocal] = useState<boolean>(true);
  const [rawText, setRawText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importSummary, setImportSummary] = useState<ManualImportSummary | null>(null);
  const [importError, setImportError] = useState<string>('');

  // Live parsing preview based on selected mode
  const parseResult: ParseResult = useMemo(() => {
    if (!rawText.trim()) {
      return { candidates: [], warnings: [], totalDetected: 0 };
    }
    try {
      if (mode === 'TEXT_PASTE') {
        return parseManualAdText(rawText, countryCode);
      } else if (mode === 'URL_REFERENCE') {
        return parseMetaAdLibraryUrls(rawText, countryCode);
      } else {
        return parseUserSuppliedCsv(rawText, countryCode);
      }
    } catch (err: any) {
      return {
        candidates: [],
        warnings: [`Parsing error: ${err.message || 'Malformed input'}`],
        totalDetected: 0
      };
    }
  }, [rawText, mode, countryCode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setRawText(content);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExecuteImport = async () => {
    if (parseResult.candidates.length === 0 || isProcessing) return;
    console.log('[ManualImportUI] Executing import for', parseResult.candidates.length, 'candidates...');
    setIsProcessing(true);
    setImportError('');
    setImportSummary(null);

    try {
      const parsedKeywords = targetKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      const activeKeywords = parsedKeywords.length > 0 ? parsedKeywords : ['Commercial', 'Business'];

      const summary = await executeManualImport(parseResult.candidates, {
        countryCode,
        locationName: countryCode === 'BD' ? 'Bangladesh' : countryCode,
        strictLocalMode: strictLocal,
        keywords: activeKeywords,
        runName: `Manual Import: ${mode === 'TEXT_PASTE' ? 'Ad Copy' : mode === 'URL_REFERENCE' ? 'Ad URLs' : 'CSV'}`
      });

      console.log('[ManualImportUI] Import succeeded:', summary.acceptedCount, 'accepted');
      setImportSummary(summary);
      onImportComplete(summary);
    } catch (err: any) {
      console.error('[ManualImportUI] Import error:', err);
      setImportError(`Import was not saved: ${err.message || 'Storage failed. Please retry.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setRawText('');
    setCsvFileName('');
    setImportSummary(null);
    setImportError('');
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto w-full text-slate-200">
      {/* Top Header Card */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">📥</span>
              Import Ad Signals Workspace
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manually import and qualify Meta Ad Library advertising signals without network scraping.
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-medium bg-sky-950/60 text-sky-400 border border-sky-500/30 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            100% Offline Processing
          </span>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 pb-1">
        <button
          type="button"
          onClick={() => { setMode('TEXT_PASTE'); setImportSummary(null); }}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
            mode === 'TEXT_PASTE'
              ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📋</span> Paste Ad Text
        </button>
        <button
          type="button"
          onClick={() => { setMode('URL_REFERENCE'); setImportSummary(null); }}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
            mode === 'URL_REFERENCE'
              ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🔗</span> Meta Ad URLs
        </button>
        <button
          type="button"
          onClick={() => { setMode('CSV_FILE'); setImportSummary(null); }}
          className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
            mode === 'CSV_FILE'
              ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📁</span> Upload Meta CSV
        </button>
      </div>

      {/* Configuration Scope */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg">
        <div>
          <label htmlFor="import-country-select" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Target Country Scope
          </label>
          <select
            id="import-country-select"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            disabled={disabled || isProcessing}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            {META_AD_LIBRARY_LOCATIONS.map((loc) => (
              <option key={loc.locationCode} value={loc.locationCode}>
                {loc.displayName} ({loc.locationCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="import-keywords-input" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Target Relevance Keywords
          </label>
          <input
            id="import-keywords-input"
            type="text"
            value={targetKeywords}
            onChange={(e) => setTargetKeywords(e.target.value)}
            placeholder="e.g. Furniture, Commercial"
            disabled={disabled || isProcessing}
            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div className="flex items-center gap-2 pt-2 md:pt-4">
          <input
            id="import-strict-local"
            type="checkbox"
            checked={strictLocal}
            onChange={(e) => setStrictLocal(e.target.checked)}
            disabled={disabled || isProcessing}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-sky-400 cursor-pointer"
          />
          <label htmlFor="import-strict-local" className="text-xs text-slate-300 cursor-pointer">
            <span className="font-medium text-slate-100">Strict Local Qualification</span>
            <span className="block text-[10px] text-slate-400">
              Foreign advertisers targeting {countryCode} marked non-local.
            </span>
          </label>
        </div>
      </div>

      {/* Main Input Area */}
      <div className="flex flex-col gap-2">
        {mode === 'CSV_FILE' ? (
          <div className="p-4 bg-slate-950 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 text-center">
            <input
              id="csv-file-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="csv-file-upload"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-sm"
            >
              Choose Local CSV File
            </label>
            <span className="text-[11px] text-slate-400">
              {csvFileName ? `Selected: ${csvFileName}` : 'Select a local CSV file manually exported or compiled from Meta Ad Library.'}
            </span>
            <span className="text-[10px] text-slate-500">
              Formula injection protected (=, +, -, @ sanitized). Delimiter auto-detected (, ; \t).
            </span>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="import-textarea" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {mode === 'TEXT_PASTE' ? 'Paste Meta Ad Copy / Text' : 'Paste Meta Ad Library URLs (one per line)'}
              </label>
              <span className="text-[10px] text-slate-500">
                {mode === 'TEXT_PASTE'
                  ? 'Includes Library ID, page name, copy, CTA, destination link, and phone/email'
                  : 'URLs inspected locally only. Never fetched or opened.'}
              </span>
            </div>
            <textarea
              id="import-textarea"
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={disabled || isProcessing}
              placeholder={
                mode === 'TEXT_PASTE'
                  ? `Library ID: 104829104819201\nActive\nAdvertiser Name\nSponsored\nLooking for genuine furniture in Dhaka?\nCall +8801712345678 or email info@brand.com\nShop Now\nhttps://brand.com.bd`
                  : `https://www.facebook.com/ads/library/?id=104829104819201\nhttps://www.facebook.com/ads/library/?id=987654321012345`
              }
              className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-400 placeholder:text-slate-600 resize-y"
            />
          </div>
        )}
      </div>

      {/* Validation & Live Preview Card */}
      {rawText.trim().length > 0 && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>🔍</span> Validation Preview
            </span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-medium bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
                {parseResult.totalDetected} Signals Detected
              </span>
              {parseResult.candidates.filter(c => (c.observedPhones?.length || 0) > 0 || (c.observedEmails?.length || 0) > 0).length > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
                  {parseResult.candidates.filter(c => (c.observedPhones?.length || 0) > 0 || (c.observedEmails?.length || 0) > 0).length} With Contacts
                </span>
              )}
            </div>
          </div>

          {/* Column mapping preview for CSV */}
          {mode === 'CSV_FILE' && parseResult.columnMapping && (
            <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-medium block mb-1">Detected Column Mappings:</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px]">
                {Object.entries(parseResult.columnMapping).map(([leadField, csvCol]) => (
                  <div key={leadField} className="flex items-center gap-1">
                    <span className="text-slate-500">{leadField}:</span>
                    <span className="text-sky-300 font-mono truncate">{csvCol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Candidates Preview (up to 3) */}
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {parseResult.candidates.slice(0, 3).map((cand, idx) => (
              <div key={cand.libraryId || idx} className="p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 truncate">{cand.pageName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {cand.libraryId}</span>
                </div>
                {cand.bodyCopy && (
                  <p className="text-[11px] text-slate-400 line-clamp-1">{cand.bodyCopy}</p>
                )}
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {cand.ctaText && (
                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-sky-300">CTA: {cand.ctaText}</span>
                  )}
                  {cand.destinationUrl && (
                    <span className="truncate max-w-[200px] text-slate-500 font-mono">{cand.destinationUrl}</span>
                  )}
                  {cand.observedPhones && cand.observedPhones.length > 0 && (
                    <span className="text-sky-400">📞 {cand.observedPhones[0].normalizedValue || cand.observedPhones[0].rawValue}</span>
                  )}
                  {cand.observedEmails && cand.observedEmails.length > 0 && (
                    <span className="text-sky-400">✉️ {cand.observedEmails[0].normalizedValue || cand.observedEmails[0].rawValue}</span>
                  )}
                </div>
              </div>
            ))}
            {parseResult.candidates.length > 3 && (
              <span className="text-[10px] text-slate-500 text-center">
                + {parseResult.candidates.length - 3} more signal(s) ready for offline qualification
              </span>
            )}
          </div>

          {/* Warnings */}
          {parseResult.warnings.length > 0 && (
            <div className="p-2 bg-sky-950/40 border border-sky-800/60 rounded text-[11px] text-sky-300 flex flex-col gap-0.5">
              <span className="font-semibold flex items-center gap-1">⚠️ Input Warnings ({parseResult.warnings.length}):</span>
              <ul className="list-disc pl-4 text-[10px] text-sky-200/90">
                {parseResult.warnings.slice(0, 3).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {parseResult.warnings.length > 3 && (
                  <li>+ {parseResult.warnings.length - 3} additional warning(s)</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {importError && <div role="alert" className="p-3 rounded-lg border border-sky-700 bg-sky-950 text-sky-200 text-sm">{importError}</div>}
      {/* Post-Import Summary Banner / Modal */}
      {importSummary && (
        <div className="p-4 bg-slate-900 border border-sky-800/80 rounded-xl flex flex-col gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <span className="text-sky-400">✓</span> Import & Qualification Complete
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Run ID: {importSummary.runId}</span>
          </div>

          {importSummary.warnings.map((warning, index) => <p key={index} role="status" className="text-xs text-sky-300">{warning}</p>)}
          {/* Metric Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-sky-950/40 border border-sky-800/60 rounded-lg">
              <span className="text-lg font-bold text-sky-400 block">{importSummary.acceptedCount}</span>
              <span className="text-[10px] uppercase font-semibold text-sky-300">Accepted Leads</span>
            </div>
            <div className="p-2 bg-sky-950/40 border border-sky-800/60 rounded-lg">
              <span className="text-lg font-bold text-sky-400 block">{importSummary.incompleteCount}</span>
              <span className="text-[10px] uppercase font-semibold text-sky-300">Incomplete (Uncertain)</span>
            </div>
            <div className="p-2 bg-sky-950/40 border border-sky-800/60 rounded-lg">
              <span className="text-lg font-bold text-sky-400 block">{importSummary.rejectedCount}</span>
              <span className="text-[10px] uppercase font-semibold text-sky-300">Rejected (Non-Local)</span>
            </div>
            <div className="p-2 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="text-lg font-bold text-slate-300 block">{importSummary.duplicateCount}</span>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Duplicates Filtered</span>
            </div>
          </div>

          {/* Rejection / Incomplete Explanations */}
          {importSummary.rejectedDetails.length > 0 && (
            <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px]">
              <span className="text-slate-400 font-medium block mb-1">Qualification Details:</span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto text-[10px]">
                {importSummary.rejectedDetails.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold truncate max-w-[200px]">{d.name}</span>
                    <span className="text-slate-500 italic">{d.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onNavigateToResults}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>📋</span> View Leads in Results Table →
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || isProcessing || !rawText}
          className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
        >
          Clear Input
        </button>

        <button
          type="button"
          onClick={handleExecuteImport}
          disabled={disabled || isProcessing || parseResult.candidates.length === 0}
          className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm shadow-sky-600/30"
        >
          {isProcessing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Qualifying Leads Offline...
            </>
          ) : (
            <>
              <span>⚡</span> Import & Qualify {parseResult.candidates.length > 0 ? `(${parseResult.candidates.length})` : ''} Leads
            </>
          )}
        </button>
      </div>
    </div>
  );
};
