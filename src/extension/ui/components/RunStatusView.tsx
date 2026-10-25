import React from 'react';
import { RunStatusViewModel, ResultRowViewModel } from '../types.ts';

interface RunStatusViewProps {
  runStatus: RunStatusViewModel | null;
  leads?: ResultRowViewModel[];
  leadCount?: number;
  collectionState?: string;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onViewResults?: () => void;
  onInspectDiagnostics?: () => void;
  onInspectLead?: (recordId: string) => void;
}

export const RunStatusView: React.FC<RunStatusViewProps> = ({
  runStatus, leads = [], leadCount = leads.length, collectionState,
  onStop, onViewResults, onInspectDiagnostics, onInspectLead
}) => {
  const running = runStatus?.globalStatus === 'RUNNING';
  const paused = collectionState === 'PAUSED';
  const failed = runStatus?.globalStatus === 'FAILED' || runStatus?.globalStatus === 'BLOCKED';
  const title = !runStatus ? 'Getting ready…' : running ? 'Collecting leads…' : paused ? 'Collection paused' : failed ? 'Collection needs attention' : collectionState === 'CANCELLED' ? 'Collection stopped' : 'Collection finished';
  const button = 'rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400';

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4" aria-label="Lead collection">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {running && <span role="img" aria-label="Collection in progress" className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400 motion-reduce:animate-none" />}
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{running ? 'New businesses appear below as they are found.' : 'Your collected leads are listed below.'}</p>
          </div>
        </div>
        {running && onStop && <button type="button" onClick={onStop} className={button}>Stop</button>}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl bg-slate-950 p-4 text-center">
        <span className="block text-4xl font-bold text-slate-100 tabular-nums">{leadCount.toLocaleString()}</span>
        <span className="mt-1 block text-xs text-slate-400">leads collected</span>
      </div>

      {runStatus?.errorMessage && <p role="alert" className="rounded-lg border border-slate-700 p-3 text-xs text-slate-200">{runStatus.errorMessage}</p>}
      {!running && runStatus?.hasWarnings && <p role="alert" className="text-xs text-slate-300">{runStatus.warningMessages[0] || 'Collection ended with a warning. Your saved leads are still available.'}</p>}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-300">Latest leads</h3>
          {onViewResults && leadCount > 0 && <button type="button" onClick={onViewResults} className="text-xs font-medium text-sky-300 underline">View all & export</button>}
        </div>
        {leads.length === 0 ? (
          <p className="rounded-lg border border-slate-800 p-5 text-center text-xs text-slate-400">{running ? 'Looking for the first lead…' : 'No leads collected yet.'}</p>
        ) : (
          <ol className="max-h-80 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800" aria-label="Collected leads">
            {leads.slice(-50).map((lead, index) => (
              <li key={lead.recordId}>
                <button type="button" onClick={() => onInspectLead?.(lead.recordId)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400">
                  <span className="text-xs text-slate-500">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-100">{lead.displayName}</span>
                    <span className="mt-1 block truncate text-xs text-slate-400">{lead.websiteUrl || 'Website not seen'}</span>
                  </span>
                  <span aria-hidden="true" className="text-sky-300">✓</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {onInspectDiagnostics && <details className="border-t border-slate-800 pt-3 text-xs text-slate-400">
        <summary className="cursor-pointer">Search details</summary>
        <div className="mt-3 flex flex-col gap-2">
          <span>Ads checked: {runStatus?.candidatesProcessed || 0}</span>
          <span>Time: {Math.floor((runStatus?.elapsedMs || 0) / 1000)} seconds</span>
          <button type="button" onClick={onInspectDiagnostics} className="self-start underline">Troubleshooting</button>
        </div>
      </details>}
    </section>
  );
};
