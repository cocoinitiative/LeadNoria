import type { ResultRowViewModel } from '../ui/types.ts';

/** Tabs delimit cells; line breaks delimit rows when pasted into Sheets. */
export function leadResultsToSheets(results: readonly ResultRowViewModel[]): string {
  const cell = (value: unknown): string => {
    const text = String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim();
    return /^[=+@-]/.test(text) ? `'${text}` : text;
  };
  const headers = ['Business', 'Facebook page', 'Website', 'Phone', 'Email', 'Business country', 'Ad target country', 'CTA', 'Website status'];
  const rows = results.filter(row => row.isExportable && !row.isRestricted).map(row => [
    row.displayName, row.canonicalRecord?.facebookPageUrl, row.websiteUrl,
    row.contactSummary.phoneText, row.contactSummary.emailText,
    row.businessCountryCode || 'Unknown', row.targetCountryCode || 'Unknown', row.ctaType,
    row.websiteUrl ? 'Website observed' : 'No website observed'
  ]);
  return [headers, ...rows].map(row => row.map(cell).join('\t')).join('\n');
}
