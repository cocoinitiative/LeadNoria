import { execSync } from 'child_process';
import path from 'path';

const suites = [
  { name: 'Clipboard Foundation', path: 'tests/test-clipboard-foundation.mjs' },
  { name: 'Clipboard UI', path: 'tests/test-clipboard-ui.mjs' },
  { name: 'Clipboard Browser Smoke', path: 'tests/test-clipboard-browser-smoke.mjs' },
  { name: 'Phase 21: Website Intelligence', path: 'tests/test-phase21-website-intelligence.mjs' },
  { name: 'Phase 22: Contact & Person Intel', path: 'tests/test-phase22-contact-person-intelligence.mjs' },
  { name: 'Phase 23: Business Intel Qualification', path: 'tests/test-phase23-business-intelligence-qualification.mjs' },
  { name: 'Phase 24: Unified Lead Intelligence', path: 'tests/test-phase24-unified-lead-intelligence.mjs' },
  { name: 'Phase 25: Unified Intelligence UI', path: 'tests/test-phase25-unified-intelligence-ui.mjs' },
  { name: 'Phase 26: Production Hardening', path: 'tests/test-phase26-production-hardening.mjs' },
  { name: 'Preset E2E', path: 'tests/test-preset-e2e.mjs' },
  { name: 'Clean Chromium E2E', path: 'tests/test-clean-chromium-prompt6.mjs' },
  { name: 'Post-Release Audit', path: 'tests/test-post-release-audit.mjs' }
];

console.log('=== RUNNING ALL ACTIVE SUITES WITH TSX ===\n');
let grandTotal = 0;
const results = [];

for (const s of suites) {
  const command = `node --import tsx ${s.path}`;
  try {
    const start = Date.now();
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const duration = Date.now() - start;
    
    // Look for assertion counts in output
    let matchedCount = null;
    const match = output.match(/(?:PASSED|Total|Executed Assertions|TOTAL.*ASSERTIONS.*?PASSED):\s*(\d+)(?:\s*\/\s*(\d+))?/i);
    
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    const summaryLines = lines.slice(-2).join(' | ');
    results.push({ name: s.name, status: 'PASS', duration, summary: summaryLines });
    console.log(`[PASS] ${s.name} (${duration}ms)`);
    console.log(`       -> ${summaryLines}`);
  } catch (err) {
    results.push({ name: s.name, status: 'FAIL', error: err.message });
    console.error(`[FAIL] ${s.name}:`, err.message);
    if (err.stdout) console.log('STDOUT tail:', err.stdout.slice(-400));
    if (err.stderr) console.error('STDERR tail:', err.stderr.slice(-400));
  }
}
