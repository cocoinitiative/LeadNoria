export const FOLLOWUP_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISMISSED'] as const;
export type FollowupStatus = typeof FOLLOWUP_STATUSES[number];
export interface LeadFollowup { status: FollowupStatus; note: string; updatedAt: string; }
export function readLeadFollowup(storage: Pick<Storage, 'getItem'>, key: string): LeadFollowup | null {
  const value = storage.getItem(`leadnoria:followup:${encodeURIComponent(key)}`);
  if (!value) return null;
  const record = JSON.parse(value);
  if (!record || !FOLLOWUP_STATUSES.includes(record.status) || typeof record.note !== 'string' || record.note.length > 2000 || typeof record.updatedAt !== 'string') throw new Error('Saved note could not be read.');
  return record;
}
export function saveLeadFollowup(storage: Pick<Storage, 'setItem'>, key: string, status: FollowupStatus, note: string): LeadFollowup {
  if (!key || !FOLLOWUP_STATUSES.includes(status) || typeof note !== 'string' || note.length > 2000) throw new Error('Choose a status and keep the note under 2,000 characters.');
  const record = { status, note, updatedAt: new Date().toISOString() };
  storage.setItem(`leadnoria:followup:${encodeURIComponent(key)}`, JSON.stringify(record));
  return record;
}
