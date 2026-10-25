import React, { useEffect, useState } from 'react';
import { businessHistoryKeys } from '../../localBusinessHistory.ts';
import { readLeadFollowup, saveLeadFollowup, type FollowupStatus } from '../../leadFollowup.ts';

export const LeadFollowupPanel: React.FC<{ record: unknown; recordId: string }> = ({ record, recordId }) => {
  const key = businessHistoryKeys(record)[0] || `record:${recordId}`;
  const [status, setStatus] = useState<FollowupStatus>('NEW');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = () => {
    try {
      const value = readLeadFollowup(window.localStorage, key);
      setStatus(value?.status || 'NEW'); setNote(value?.note || ''); setError(''); setLoaded(true); setSaved(false);
    } catch { setLoaded(false); setError('Could not load your saved note. Retry before editing.'); }
  };
  useEffect(load, [key]);
  return <section className="p-3 rounded-lg border border-slate-700 bg-slate-900 space-y-2">
    <h3 className="text-sm font-semibold text-slate-100">Your follow-up</h3>
    <label className="block text-xs text-slate-300">Lead status
      <select aria-label="Lead status" disabled={!loaded} value={status} onChange={e => { setStatus(e.target.value as FollowupStatus); setSaved(false); }} className="ml-2 p-2 rounded bg-slate-950 border border-slate-700">
        <option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="QUALIFIED">Qualified by me</option><option value="DISMISSED">Not interested</option>
      </select>
    </label>
    <label className="block text-xs text-slate-300">Private note
      <textarea aria-label="Private lead note" disabled={!loaded} maxLength={2000} rows={3} value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} className="w-full mt-1 p-2 rounded bg-slate-950 border border-slate-700" />
    </label>
    <p className="text-xs text-slate-400">Saved on this device. Your status does not change the automated country or quality checks.</p>
    <button disabled={!loaded} className="px-3 py-2 rounded bg-sky-600 text-white text-xs disabled:opacity-50" onClick={() => {
      try { saveLeadFollowup(window.localStorage, key, status, note); setSaved(true); setError(''); }
      catch { setSaved(false); setError('Note was not saved. Storage may be full or unavailable. Your text is still here.'); }
    }}>Save follow-up</button>
    {!loaded && <button className="ml-2 text-xs underline" onClick={load}>Retry loading note</button>}
    {error && <p role="alert" className="text-xs text-sky-300">{error}</p>}
    {saved && <p role="status" className="text-xs text-sky-300">Follow-up saved on this device.</p>}
  </section>;
};
