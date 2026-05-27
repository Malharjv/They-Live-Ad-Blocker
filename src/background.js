const DEFAULT_ENABLED = true;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: DEFAULT_ENABLED });
    }
  });
});
