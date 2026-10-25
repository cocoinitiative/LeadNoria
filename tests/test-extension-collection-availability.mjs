import assert from 'node:assert/strict';
import { canStartExtensionCollection } from '../src/extension/collectionAvailability.ts';
const previous = globalThis.chrome;
try {
  delete globalThis.chrome;
  assert.equal(canStartExtensionCollection(), false, 'Hosted preview cannot start an extension run');
  globalThis.chrome = { runtime: { sendMessage() {} } };
  assert.equal(canStartExtensionCollection(), false, 'A partial runtime is not sufficient');
  globalThis.chrome = {
    runtime: { id: 'installed-extension', sendMessage() {} },
    tabs: { create() {}, sendMessage() {} },
    storage: { local: { get() {} } }
  };
  assert.equal(canStartExtensionCollection(), true, 'Installed MV3 context can start user-requested collection');
  delete globalThis.chrome.tabs.sendMessage;
  assert.equal(canStartExtensionCollection(), false, 'Missing tab messaging prevents a broken run');
  console.log('PASS extension collection availability: 4 runtime cases; no live request made');
} finally {
  if (previous === undefined) delete globalThis.chrome;
  else globalThis.chrome = previous;
}
