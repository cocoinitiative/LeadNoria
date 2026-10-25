import type { ResultRowViewModel } from '../ui/types.ts';

/** Tabs delimit cells; line breaks delimit rows when pasted into Sheets. */
export const LEAD_EXPORT_COLUMNS = ['Business', 'Facebook page', 'Website', 'Phone', 'Email', 'Business country', 'Ad target country', 'CTA', 'Website status', 'Ad copy'] as const;
export type LeadExportColumn = typeof LEAD_EXPORT_COLUMNS[number];
const DEFAULT_COLUMNS = LEAD_EXPORT_COLUMNS.slice(0, 9);

function exportRows(results: readonly ResultRowViewModel[], columns: readonly LeadExportColumn[]) {
  const headers = [...new Set(columns)].filter(column => LEAD_EXPORT_COLUMNS.includes(column));
  if (!headers.length) throw new Error('Choose at least one export column.');
  const rows = results.filter(row => row.isExportable && !row.isRestricted).map(row => {
    const values: Record<LeadExportColumn, unknown> = {
      'Business': row.displayName, 'Facebook page': row.canonicalRecord?.facebookPageUrl,
      'Website': row.websiteUrl, 'Phone': row.contactSummary.phoneText, 'Email': row.contactSummary.emailText,
      'Business country': row.businessCountryCode || 'Unknown', 'Ad target country': row.targetCountryCode || 'Unknown',
      'CTA': row.ctaType, 'Website status': row.websiteUrl ? 'Website observed' : 'No website observed',
      'Ad copy': row.canonicalRecord?.sampleCopy || row.canonicalRecord?.adEvidence?.[0]?.bodyCopy
    };
    return headers.map(column => values[column]);
  });
  return [headers, ...rows];
}

function safeCell(value: unknown, flatten: boolean): string {
  const text = (flatten ? String(value ?? '').replace(/[\t\r\n]+/g, ' ') : String(value ?? '')).trim();
  return /^[=+@-]/.test(text) ? `'${text}` : text;
}

export function leadResultsToSheets(results: readonly ResultRowViewModel[], columns: readonly LeadExportColumn[] = DEFAULT_COLUMNS): string {
  return exportRows(results, columns).map(row => row.map(value => safeCell(value, true)).join('\t')).join('\n');
}

export function leadResultsToCsv(results: readonly ResultRowViewModel[], columns: readonly LeadExportColumn[]): string {
  return exportRows(results, columns).map(row => row.map(value => `"${safeCell(value, false).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}
