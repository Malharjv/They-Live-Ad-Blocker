const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

function updateUI(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? 'Revealing ads' : 'Inactive';
  status.classList.toggle('popup__status--off', !enabled);
}

async function applyToTab(tabId, enabled) {
  const message = { type: 'TOGGLE', enabled };

  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {
    // Content script missing — inject it (e.g. after extension reload)
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['src/replacer.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js'],
    });
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // chrome:// and other restricted pages cannot be injected
  }
}

chrome.storage.local.get(['enabled'], (result) => {
  updateUI(result.enabled !== false);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled }, async () => {
    updateUI(enabled);

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await applyToTab(tabs[0].id, enabled);
    }
  });
});
