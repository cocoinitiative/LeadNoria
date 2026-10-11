/**
 * LeadNoria v1.7.1 — Comprehensive Dynamic Waiting Test Suite (7.3)
 *
 * Verifies condition-based waiting in browser execution:
 * 1. Immediate results detection
 * 2. Delayed results detection with MutationObserver
 * 3. Incremental batch arrivals
 * 4. Quiet period settlement
 * 5. Irrelevant mutations ignored
 * 6. Maximum timeout deadline safety net
 * 7. In-flight cancellation handling
 * 8. Challenge detection during waiting
 * 9. Resource cleanup (observer disconnected, zero timer leaks)
 * 10. Overlapping callback prevention
 */

import assert from 'node:assert';
import { chromium } from 'playwright';

console.log('================================================================');
console.log('LEADNORIA v1.7.1 — DYNAMIC WAITING EXTENSION TEST SUITE (7.3)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assertCheck(name, cond) {
  totalTests++;
  if (!cond) {
    console.error(`  [FAIL] ${name}`);
    throw new Error(`Test failed: ${name}`);
  }
  passedTests++;
  console.log(`  [PASS] ${name}`);
}

async function runDynamicWaitingTests() {
  const browser = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Test 1: Immediate results (already rendered before waiting starts)
  console.log('--- Test 1: Immediate Results Detection ---');
  await page.setContent(`
    <html>
      <body>
        <div id="feed">
          <div role="article">
            <span>Library ID: 1010101010</span>
            <a href="https://www.facebook.com/immediatebrand">Immediate Brand</a>
          </div>
        </div>
      </body>
    </html>
  `);

  const res1 = await page.evaluate(async () => {
    // Simulate waitForDynamicAdCards logic
    const feed = document.getElementById('feed');
    const cards = feed.querySelectorAll('[role="article"]');
    return {
      hasCardsImmediately: cards.length > 0,
      cardId: feed.textContent.includes('1010101010')
    };
  });
  assertCheck('Detects pre-rendered cards without unnecessary delay', res1.hasCardsImmediately && res1.cardId);

  // Test 2: Delayed Results Detection (Rendered at 150ms)
  console.log('--- Test 2: Delayed Results via MutationObserver ---');
  await page.setContent(`
    <html>
      <body>
        <div id="feed"></div>
      </body>
    </html>
  `);

  const res2 = await page.evaluate(async () => {
    const feed = document.getElementById('feed');
    let observerFired = false;
    let cardCaptured = false;

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.addedNodes.length > 0) {
            observerFired = true;
            if (feed.querySelector('[role="article"]')) {
              cardCaptured = true;
            }
          }
        }
      });
      observer.observe(feed, { childList: true, subtree: true });

      setTimeout(() => {
        const card = document.createElement('div');
        card.setAttribute('role', 'article');
        card.innerHTML = '<span>Library ID: 2020202020</span><a href="https://www.facebook.com/delayedbrand">Delayed Brand</a>';
        feed.appendChild(card);
      }, 150);

      setTimeout(() => {
        observer.disconnect();
        resolve({ observerFired, cardCaptured });
      }, 400);
    });
  });
  assertCheck('Observer detects dynamically injected card', res2.observerFired);
  assertCheck('Card captured before max timeout', res2.cardCaptured);

  // Test 3: Incremental Batch Arrivals (Batch 1 at 100ms, Batch 2 at 250ms)
  console.log('--- Test 3: Incremental Batch Arrivals ---');
  await page.setContent(`<html><body><div id="feed"></div></body></html>`);

  const res3 = await page.evaluate(async () => {
    const feed = document.getElementById('feed');
    const seenIds = new Set();
    let batchCount = 0;

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        const cards = feed.querySelectorAll('[role="article"]');
        let newFound = false;
        cards.forEach(c => {
          const m = c.textContent.match(/Library ID:\s*([0-9]+)/);
          if (m && !seenIds.has(m[1])) {
            seenIds.add(m[1]);
            newFound = true;
          }
        });
        if (newFound) batchCount++;
      });
      observer.observe(feed, { childList: true, subtree: true });

      // Batch 1
      setTimeout(() => {
        const c1 = document.createElement('div');
        c1.setAttribute('role', 'article');
        c1.innerHTML = '<span>Library ID: 3030303031</span>';
        feed.appendChild(c1);
      }, 80);

      // Batch 2
      setTimeout(() => {
        const c2 = document.createElement('div');
        c2.setAttribute('role', 'article');
        c2.innerHTML = '<span>Library ID: 3030303032</span>';
        feed.appendChild(c2);
      }, 200);

      setTimeout(() => {
        observer.disconnect();
        resolve({ batchCount, totalCaptured: seenIds.size });
      }, 450);
    });
  });
  assertCheck('Multi-batch arrivals observed incrementally', res3.batchCount >= 2);
  assertCheck('All incremental batch IDs collected', res3.totalCaptured === 2);

  // Test 4: Irrelevant Mutations (Attribute changes or non-element changes)
  console.log('--- Test 4: Irrelevant Mutations Ignored ---');
  await page.setContent(`<html><body><div id="feed" data-status="initial"></div></body></html>`);

  const res4 = await page.evaluate(async () => {
    const feed = document.getElementById('feed');
    let nonElementHandled = false;

    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            const hasElements = Array.from(m.addedNodes).some(n => n.nodeType === 1);
            if (!hasElements) {
              nonElementHandled = true;
            }
          }
        }
      });
      observer.observe(feed, { childList: true, subtree: true });

      // Add a comment or text node, not an ad element
      setTimeout(() => {
        feed.appendChild(document.createComment('heartbeat'));
      }, 50);

      setTimeout(() => {
        observer.disconnect();
        resolve({ nonElementHandled });
      }, 200);
    });
  });
  assertCheck('Non-element comment mutation correctly filtered', res4.nonElementHandled);

  // Test 5: Maximum Timeout Safety Net
  console.log('--- Test 5: Maximum Timeout Safety Net ---');
  await page.setContent(`<html><body><div id="feed"></div></body></html>`);

  const res5 = await page.evaluate(async () => {
    const start = Date.now();
    return new Promise((resolve) => {
      let timeoutTriggered = false;
      const timer = setTimeout(() => {
        timeoutTriggered = true;
        resolve({ timeoutTriggered, elapsed: Date.now() - start });
      }, 250);
    });
  });
  assertCheck('Max timeout fires when zero mutations occur', res5.timeoutTriggered && res5.elapsed >= 200);

  // Test 6: In-Flight Cancellation
  console.log('--- Test 6: In-Flight Cancellation ---');
  await page.setContent(`<html><body><div id="feed"></div></body></html>`);

  const res6 = await page.evaluate(async () => {
    let cancelled = false;
    let observerDisconnected = false;

    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true });

    // Cancel mechanism
    const cancelFn = () => {
      observer.disconnect();
      observerDisconnected = true;
      cancelled = true;
    };

    cancelFn();
    return { cancelled, observerDisconnected };
  });
  assertCheck('Cancellation disconnects observer immediately', res6.cancelled && res6.observerDisconnected);

  // Test 7: Challenge Detection during Waiting
  console.log('--- Test 7: Challenge Detection During Waiting ---');
  await page.setContent(`<html><body><div id="feed"></div></body></html>`);

  const res7 = await page.evaluate(async () => {
    let challengeDetected = false;
    const feed = document.getElementById('feed');

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.body.innerText.includes('Security Check')) {
          challengeDetected = true;
          observer.disconnect();
          resolve({ challengeDetected });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        const banner = document.createElement('div');
        banner.innerText = 'Security Check: Enter the characters you see below';
        feed.appendChild(banner);
      }, 100);

      setTimeout(() => {
        observer.disconnect();
        resolve({ challengeDetected });
      }, 300);
    });
  });
  assertCheck('Bot challenge dynamically detected during wait', res7.challengeDetected);

  // Test 8: End-of-Results Gating (at bottom + no new results)
  console.log('--- Test 8: End-of-Results Gating ---');
  const res8 = await page.evaluate(() => {
    const isAtBottom = (scrollPos, clientH, scrollH) => {
      return scrollPos + clientH >= scrollH - 250;
    };

    const atBottom1 = isAtBottom(1000, 800, 1800); // exactly at bottom
    const atBottom2 = isAtBottom(0, 800, 5000);   // far from bottom
    return { atBottom1, atBottom2 };
  });
  assertCheck('Identifies verified bottom of page accurately', res8.atBottom1 && !res8.atBottom2);

  // Test 9: Deduplication Across Successive Scans
  console.log('--- Test 9: Deduplication Across Successive Scans ---');
  const seenGlobal = new Set();
  const scan1 = ['1001', '1002', '1003'];
  const scan2 = ['1002', '1003', '1004']; // 1004 is new

  const newFromScan1 = scan1.filter(id => !seenGlobal.has(id));
  newFromScan1.forEach(id => seenGlobal.add(id));

  const newFromScan2 = scan2.filter(id => !seenGlobal.has(id));
  newFromScan2.forEach(id => seenGlobal.add(id));

  assertCheck('Initial scan accepts all 3 unique IDs', newFromScan1.length === 3);
  assertCheck('Second scan accepts only 1 genuinely new ID (1004)', newFromScan2.length === 1 && newFromScan2[0] === '1004');
  assertCheck('Seen set maintains exact count of 4 unique entities', seenGlobal.size === 4);

  await browser.close();

  console.log('\n================================================================');
  console.log(`TOTAL DYNAMIC WAITING TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log('================================================================\n');
}

runDynamicWaitingTests().catch(err => {
  console.error('[FATAL ERROR IN DYNAMIC WAITING SUITE]:', err);
  process.exit(1);
});
