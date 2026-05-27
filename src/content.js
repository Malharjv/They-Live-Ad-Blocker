const MESSAGES = [
  'OBEY',
  'CONSUME',
  'STAY ASLEEP',
  'NO INDEPENDENT THOUGHT',
  'DO NOT QUESTION AUTHORITY',
  'SUBMIT',
  'BUY',
  'MARRY AND REPRODUCE',
  'WATCH TV',
  'CONFORM',
];

const AD_SELECTORS = [
  'ins.adsbygoogle',
  '[id*="google_ads"]',
  '[id*="GoogleAd"]',
  '[id^="div-gpt-ad"]',
  '[class*="ad-container"]',
  '[class*="ad_container"]',
  '[class*="advertisement"]',
  '[class*="ad-banner"]',
  '[class*="ad_banner"]',
  '[class*="ad-slot"]',
  '[class*="ad_slot"]',
  '[class*="sponsored-content"]',
  '[data-ad-slot]',
  '[data-ad]',
  '[data-advertisement]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="googleadservices.com"]',
  'iframe[src*="adnxs.com"]',
  'iframe[src*="taboola.com"]',
  'iframe[src*="outbrain.com"]',
  'iframe[src*="adservice"]',
  'iframe[src*="amazon-adsystem.com"]',
  'iframe[src*="criteo.com"]',
  'iframe[src*="pubmatic.com"]',
  'iframe[src*="openx.net"]',
  '[aria-label*="advertisement" i]',
  '[aria-label*="sponsored" i]',
];

const AD_CLASS_PATTERNS = [
  /\bad[-_]?(banner|slot|unit|container|wrapper|box|block|frame|content|placement|holder)\b/i,
  /\b(advert|advertisement|sponsored|promo[-_]?ad)\b/i,
  /\bgoogle[-_]?ad/i,
  /\badsbygoogle\b/i,
];

const STANDARD_AD_SIZES = [
  [728, 90], [468, 60], [234, 60], [88, 31],
  [120, 90], [120, 240], [125, 125], [160, 600],
  [180, 150], [300, 250], [336, 280], [250, 250],
  [200, 200], [300, 600], [970, 90], [970, 250],
  [320, 50], [320, 100], [300, 50], [300, 100],
  [240, 400], [250, 360], [580, 400],
];

const MIN_AD_WIDTH = 88;
const MIN_AD_HEIGHT = 31;
const SIZE_TOLERANCE = 8;
const SCAN_DEBOUNCE_MS = 300;

let enabled = true;
const blockedAds = new Map();
let observer = null;
let scanTimer = null;

function pickMessage(element) {
  const seed = element.tagName.length + element.className.length + element.id.length;
  return MESSAGES[seed % MESSAGES.length];
}

function isStandardAdSize(width, height) {
  return STANDARD_AD_SIZES.some(
    ([w, h]) =>
      Math.abs(width - w) <= SIZE_TOLERANCE && Math.abs(height - h) <= SIZE_TOLERANCE
  );
}

function hasAdPattern(element) {
  const id = element.id || '';
  const className = typeof element.className === 'string' ? element.className : '';
  const combined = `${id} ${className}`;

  return AD_CLASS_PATTERNS.some((pattern) => pattern.test(combined));
}

function isLikelyAd(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (blockedAds.has(element)) return false;
  if (element.closest('.they-live-wrapper')) return false;
  if (element.closest('.they-live-replacement')) return false;
  if (element.classList.contains('they-live-replacement')) return false;

  for (const blocked of blockedAds.keys()) {
    if (blocked !== element && blocked.contains(element)) return false;
  }

  const tag = element.tagName;
  if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'ARTICLE') return false;

  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  if (width < MIN_AD_WIDTH || height < MIN_AD_HEIGHT) return false;
  if (width > window.innerWidth * 0.95 && height > window.innerHeight * 0.8) return false;

  if (AD_SELECTORS.some((selector) => element.matches(selector))) return true;
  if (hasAdPattern(element)) return true;

  if (tag === 'IFRAME') {
    const src = element.getAttribute('src') || '';
    if (/ad|doubleclick|syndication|sponsor|promo|taboola|outbrain/i.test(src)) return true;
    if (isStandardAdSize(width, height) && !src.includes(window.location.hostname)) return true;
  }

  if (isStandardAdSize(width, height) && hasAdPattern(element.parentElement || element)) {
    return true;
  }

  return isStandardAdSize(width, height) && hasAdPattern(element);
}

function computeFontSize(width, height, message) {
  const charCount = message.length;
  const byWidth = (width * 0.85) / (charCount * 0.55);
  const byHeight = height * 0.35;
  return Math.max(10, Math.min(byWidth, byHeight, 48));
}

function buildOverlay(width, height, message) {
  const overlay = document.createElement('div');
  overlay.className = 'they-live-replacement';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';

  const text = document.createElement('span');
  text.className = 'they-live-replacement__text';
  text.textContent = message;
  text.style.fontSize = `${computeFontSize(width, height, message)}px`;
  overlay.appendChild(text);

  return overlay;
}

function getBlockTarget(element) {
  if (element.tagName !== 'IFRAME') return element;

  let parent = element.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    if (parent.closest('.they-live-wrapper')) break;
    if (hasAdPattern(parent)) return parent;
    try {
      if (AD_SELECTORS.some((selector) => parent.matches(selector))) return parent;
    } catch {
      // ignore invalid selector match on parent
    }
    parent = parent.parentElement;
  }

  return element;
}

function restoreAd(element) {
  const record = blockedAds.get(element);
  if (!record) return;

  try {
    element.classList.remove('they-live-hidden-ad');
    delete element.dataset.theyLiveBlocked;

    if (record.mode === 'in-place') {
      record.overlay.remove();
      if (record.parent?.dataset.theyLivePositionPatched) {
        record.parent.style.position = '';
        delete record.parent.dataset.theyLivePositionPatched;
      }
    } else {
      const parent = record.wrapper.parentElement;
      if (parent) {
        parent.insertBefore(element, record.wrapper);
      }
      record.wrapper.remove();
    }
  } catch {
    // best-effort restore
  }

  blockedAds.delete(element);
}

function restoreAll() {
  for (const element of [...blockedAds.keys()]) {
    try {
      restoreAd(element);
    } catch {
      blockedAds.delete(element);
    }
  }
}

function blockInPlace(element, parent, overlay, width, height, message) {
  if (getComputedStyle(parent).position === 'static') {
    parent.dataset.theyLivePositionPatched = 'true';
    parent.style.position = 'relative';
  }

  overlay.style.top = `${element.offsetTop}px`;
  overlay.style.left = `${element.offsetLeft}px`;
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  overlay.style.zIndex = '2147483646';

  parent.insertBefore(overlay, element.nextSibling);
  element.classList.add('they-live-hidden-ad');
  element.dataset.theyLiveBlocked = 'true';

  blockedAds.set(element, { mode: 'in-place', overlay, parent, width, height, message });
}

function blockWithWrapper(element, parent, overlay, width, height, message) {
  const display = getComputedStyle(element).display;
  const wrapperDisplay =
    display === 'inline' || display === 'inline-block' ? 'inline-block' : 'block';

  const wrapper = document.createElement('div');
  wrapper.className = 'they-live-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.display = wrapperDisplay;
  wrapper.style.verticalAlign = getComputedStyle(element).verticalAlign;

  parent.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  wrapper.appendChild(overlay);

  element.classList.add('they-live-hidden-ad');
  element.dataset.theyLiveBlocked = 'true';

  blockedAds.set(element, {
    mode: 'wrapper',
    wrapper,
    overlay,
    width,
    height,
    message,
    display: wrapperDisplay,
  });
}

function blockAd(element) {
  if (!enabled || blockedAds.has(element)) return;

  try {
    const target = getBlockTarget(element);
    if (blockedAds.has(target)) return;
    if (!target.isConnected) return;

    const parent = target.parentElement;
    if (!parent) return;

    const rect = target.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < MIN_AD_WIDTH || height < MIN_AD_HEIGHT) return;

    const message = pickMessage(target);
    const overlay = buildOverlay(width, height, message);

    if (target.tagName === 'IFRAME') {
      blockInPlace(target, parent, overlay, width, height, message);
    } else {
      blockWithWrapper(target, parent, overlay, width, height, message);
    }
  } catch {
    // Skip sandboxed or protected elements
  }
}

function collectCandidates(root) {
  const found = new Set();

  for (const selector of AD_SELECTORS) {
    try {
      root.querySelectorAll(selector).forEach((el) => found.add(el));
    } catch {
      // invalid selector on some pages
    }
  }

  const elements = root.querySelectorAll('iframe, ins, div, aside, section, span');
  elements.forEach((el) => {
    if (isLikelyAd(el)) found.add(el);
  });

  return [...found];
}

function scanPage() {
  if (!enabled) return;

  const candidates = collectCandidates(document);
  for (const element of candidates) {
    if (isLikelyAd(element)) {
      blockAd(element);
    }
  }
}

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(scanPage, SCAN_DEBOUNCE_MS);
}

function startObserver() {
  if (observer) return;

  observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'id', 'src', 'style'],
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  clearTimeout(scanTimer);
}

function setEnabled(value) {
  enabled = value !== false;

  if (enabled) {
    scanPage();
    startObserver();
  } else {
    stopObserver();
    restoreAll();
  }
}

chrome.storage.local.get(['enabled'], (result) => {
  setEnabled(result.enabled !== false);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) {
    setEnabled(changes.enabled.newValue !== false);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TOGGLE') {
    setEnabled(message.enabled !== false);
  }
});

window.addEventListener('resize', () => {
  if (enabled) scheduleScan();
});
