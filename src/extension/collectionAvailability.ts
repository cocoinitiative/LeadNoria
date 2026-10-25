/** User-started collection runs only inside the installed extension. */
export function canStartExtensionCollection(): boolean {
  return typeof chrome !== 'undefined'
    && Boolean(chrome.runtime?.id)
    && typeof chrome.runtime?.sendMessage === 'function'
    && typeof chrome.tabs?.create === 'function'
    && typeof chrome.tabs?.sendMessage === 'function'
    && typeof chrome.storage?.local?.get === 'function';
}
