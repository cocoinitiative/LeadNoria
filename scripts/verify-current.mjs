import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  'test-every-page-five-column-benchmark',
  'test-public-page-research',
  'test-extension-collection-availability',
  'test-extension-collection-pipeline',
  'test-phase01-safety-lock', 'test-relevance-engine', 'test-entity-resolution', 'test-evidence-waterfall',
  'test-geographic-accuracy', 'test-global-country-profiles', 'test-strict-local-mode-contract',
  'test-cta-destination-export', 'test-storage-recovery-integrity', 'test-qualification-scoring',
  'test-ui-workflow-qualification', 'test-phase25-unified-intelligence-ui',
  'test-phase02-cta-destination-remediation', 'test-phase03-niche-qualification-remediation',
  'test-phase04-identity-deduplication', 'test-phase05-discovery-extraction',
  'test-e2e-country-website-cta-classification', 'test-phase34-manual-import',
  'test-country-cta-user-flow', 'test-simple-ui-sheets', 'test-offline-destination-links',
  'test-local-business-history', 'test-free-workflow-tools',
  'test-phase10-ui-filters-research-workflow', 'test-phase11-performance-scalability'
];
const digest = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const zip = path.join(root, 'extension.zip');
const before = digest(zip);
const results = [];
const run = (name, args) => {
  const start = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
  const passed = result.status === 0;
  results.push({ name, passed, seconds: (Date.now()-start)/1000, output: `${result.stdout || ''}${result.stderr || ''}`, error: result.error?.message });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} (${results.at(-1).seconds.toFixed(1)}s)`);
  if (!passed) console.error(results.at(-1).output.slice(-5000), result.error?.message || '');
  return passed;
};
console.log('Current offline workflow verification. No live browser or live Meta claim.');
console.log('Historical v1.7.5/v1.7.6 archive gates remain separate: npm run verify:legacy.');
const compiled = run('TypeScript', ['node_modules/typescript/bin/tsc', '--noEmit']);
const built = compiled && run('Unpacked extension build', ['scripts/build-extension.mjs', '--unpacked-only']);
if (built) for (const suite of suites) run(suite, ['--import', 'tsx', `tests/${suite}.mjs`]);
const immutable = before === digest(zip);
results.push({ name: 'Current distribution ZIP unchanged by verification', passed: immutable });
console.log(`${immutable ? 'PASS' : 'FAIL'} Current distribution ZIP unchanged by verification`);
const report = process.argv.indexOf('--report');
if (report >= 0 && process.argv[report+1]) fs.writeFileSync(path.resolve(process.argv[report+1]), JSON.stringify({ scope: 'current-offline', results }, null, 2));
const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({ currentWorkflowSuites: built ? suites.length : 0, checks: results.length, failed: failed.map(result=>result.name), legacyReleaseArchives: 'separate, not included' }));
process.exit(failed.length || !built ? 1 : 0);
