import type { ResultRowViewModel } from '../ui/types.ts';

export const LEAD_EXPORT_COLUMNS = ['Page name', 'Page URL', 'Website', 'Email', 'Phone'] as const;

function contactValues(row: ResultRowViewModel, type: 'PHONE' | 'EMAIL'): string {
  const profile = row.canonicalRecord?.contactProfile;
  const observations = type === 'PHONE' ? profile?.observedPhones : profile?.observedEmails;
  const values = observations?.filter((item: any) => item.syntaxState === 'SYNTAX_VALID' || (type === 'PHONE' && item.syntaxState === 'AMBIGUOUS'))
    .map((item: any) => item.normalizedValue || item.rawValue).filter(Boolean) || [];
  const fallback = type === 'PHONE' ? row.contactSummary.phoneText : row.contactSummary.emailText;
  return [...new Set(values.length ? values : fallback ? [fallback] : [])].join('; ');
}

function exportRows(results: readonly ResultRowViewModel[]) {
  return [LEAD_EXPORT_COLUMNS, ...results.filter(row => row.isExportable && !row.isRestricted).map(row => [
    row.displayName, row.canonicalRecord?.facebookPageUrl || '', row.websiteUrl || '',
    contactValues(row, 'EMAIL'), contactValues(row, 'PHONE')
  ])];
}

function safeCell(value: unknown): string {
  const text = String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  return /^[=+@-]|^0\d/.test(text) ? `'${text}` : text;
}

/** Five columns only. Tabs delimit cells for direct Google Sheets pasting. */
export function leadResultsToSheets(results: readonly ResultRowViewModel[]): string {
  return exportRows(results).map(row => row.map(safeCell).join('\t')).join('\n');
}

export function leadResultsToCsv(results: readonly ResultRowViewModel[]): string {
  return exportRows(results).map(row => row.map(value => `"${safeCell(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
