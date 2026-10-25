import assert from 'node:assert/strict';
import { leadResultsToSheets } from '../src/extension/clipboard/leadSheets.ts';
import { evaluateLeadQualificationGates } from '../src/extension/qualificationGate.ts';
const row = { displayName: 'বাংলা Furniture\nDhaka', isExportable: true, isRestricted: false,
  websiteUrl: 'https://example.com', businessCountryCode: 'BD', targetCountryCode: 'BD', ctaType: 'SHOP_NOW',
  canonicalRecord: { facebookPageUrl: 'https://facebook.com/example' },
  contactSummary: { phoneText: '+8801700000000', emailText: '=HYPERLINK("bad")' } };
const tsv = leadResultsToSheets([row, { ...row, isRestricted: true }]);
const lines = tsv.split('\n').map(line => line.split('\t'));
assert.equal(lines.length, 2);
assert.equal(lines[0].length, 5);
assert.equal(lines[1].length, 5);
assert.equal(lines[1][0], 'বাংলা Furniture Dhaka');
assert.equal(lines[1][4], "'+8801700000000");
assert.ok(lines[1][3].startsWith("'="));
assert.deepEqual(lines[0], ['Page name','Page URL','Website','Email','Phone']);
assert.equal(lines[1][2], 'https://example.com');
assert.ok(!leadResultsToSheets([{ ...row, isExportable: false }]).includes('বাংলা'));
const lead = { websiteState: 'unknown', primaryDestinationType: 'MESSAGING', status: 'REVIEW_REQUIRED', relevanceDecision: 'RELEVANT', geographicClassification: 'LOCAL_VERIFIED', targetCountryCode: 'BD', businessCountryCode: 'BD' };
const criteria = { websiteRequirement: 'WITHOUT_OBSERVED_WEBSITE' };
assert.ok(evaluateLeadQualificationGates(lead, criteria).passedGates.includes('GATE_WEBSITE'));
assert.ok(evaluateLeadQualificationGates({ ...lead, websiteState: 'found' }, criteria).failedGates.includes('GATE_WEBSITE'));
console.log('Simple UI: Sheets columns, Unicode, restrictions, formula escaping, website preference passed.');
