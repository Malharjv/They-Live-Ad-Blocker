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

const STRONG_AD_SELECTORS = [
  'ins.adsbygoogle',
  '[id*="google_ads"]',
  '[id*="GoogleAd"]',
  '[id^="div-gpt-ad"]',
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

const AD_IFRAME_PATTERN =
  /doubleclick|googlesyndication|googleadservices|adnxs|taboola|outbrain|adservice|amazon-adsystem|criteo|pubmatic|openx/i;

const AD_CLASS_PATTERNS = [
  /\badsbygoogle\b/i,
  /\bgoogle[-_]?ad/i,
  /\bad[-_]?(banner|slot|unit|container|wrapper|box|block|frame|placement|holder)\b/i,
  /\badvert[-_]?(slot|banner|container|wrapper|isement)\b/i,
  /\bsponsored[-_]?(content|ad|listing|post)\b/i,
  /\bpub[-_]?ad\b/i,
  /\bdfp[-_]?(ad|slot)\b/i,
];

const EXCLUDE_PATTERNS = [
  /\b(article|content-body|main-content|post-content|entry-content|comment|comments|navigation|navbar|footer|header|sidebar-widget|related-articles|newsletter|social-share)\b/i,
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
let messageCounter = 0;

function pickMessage() {
  const message = MESSAGES[messageCounter % MESSAGES.length];
  messageCounter += 1;
  return message;
}

function getElementSize(element) {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width) || element.offsetWidth,
    height: Math.round(rect.height) || element.offsetHeight,
  };
}

function isStandardAdSize(width, height) {
  return STANDARD_AD_SIZES.some(
    ([w, h]) =>
      Math.abs(width - w) <= SIZE_TOLERANCE && Math.abs(height - h) <= SIZE_TOLERANCE
  );
}

function matchesStrongSelector(element) {
  return STRONG_AD_SELECTORS.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function hasAdPattern(element) {
  const id = element.id || '';
  const className = typeof element.className === 'string' ? element.className : '';
  const combined = `${id} ${className}`;

  return AD_CLASS_PATTERNS.some((pattern) => pattern.test(combined));
}

function isExcludedElement(element) {
  const id = element.id || '';
  const className = typeof element.className === 'string' ? element.className : '';
  const combined = `${id} ${className} ${element.getAttribute('role') || ''}`;

  if (EXCLUDE_PATTERNS.some((pattern) => pattern.test(combined))) return true;
  if (element.closest('article, [role="article"], main p, .comment, .comments, nav, footer, header')) {
    return !matchesStrongSelector(element);
  }

  return false;
}

function hasSubstantiveContent(element) {
  if (element.querySelector('article, p, h1, h2, h3, h4, nav, form, table, ul, ol')) return true;

  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  if (text.length > 100) return true;
  if (text.split(' ').length > 18) return true;

  return false;
}

function isAdIframe(element) {
  const src = element.getAttribute('src') || '';
  return AD_IFRAME_PATTERN.test(src);
}

function isLikelyAd(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (blockedAds.has(element)) return false;
  if (element.closest('.they-live-wrapper')) return false;
  if (element.closest('.they-live-replacement')) return false;
  if (element.classList.contains('they-live-replacement')) return false;
  if (element.dataset.theyLiveBlocked === 'true') return false;
  if (element.querySelector('[data-they-live-blocked]')) return false;

  for (const blocked of blockedAds.keys()) {
    if (blocked !== element && blocked.contains(element)) return false;
  }

  const tag = element.tagName;
  if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'ARTICLE') return false;
  if (isExcludedElement(element)) return false;

  const { width, height } = getElementSize(element);

  if (width < MIN_AD_WIDTH || height < MIN_AD_HEIGHT) return false;
  if (width > window.innerWidth * 0.9 && height > window.innerHeight * 0.75) return false;

  if (matchesStrongSelector(element)) return true;

  if (tag === 'IFRAME') {
    return isAdIframe(element);
  }

  if (tag === 'INS' && element.classList.contains('adsbygoogle')) return true;

  if (!isStandardAdSize(width, height)) return false;
  if (!hasAdPattern(element)) return false;
  if (hasSubstantiveContent(element)) return false;

  return true;
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

function isRiskySandboxIframe(element) {
  if (element.tagName !== 'IFRAME') return false;
  const sandbox = element.getAttribute('sandbox') || '';
  return sandbox.includes('allow-scripts') && sandbox.includes('allow-same-origin');
}

function containsRiskySandboxIframe(element) {
  if (isRiskySandboxIframe(element)) return true;
  return [...element.querySelectorAll('iframe')].some(isRiskySandboxIframe);
}

function shouldUseInPlaceBlock(element) {
  return element.tagName === 'IFRAME' || containsRiskySandboxIframe(element);
}

function getBlockTarget(element) {
  if (element.tagName !== 'IFRAME') return element;
  if (isRiskySandboxIframe(element)) return element;

  let parent = element.parentElement;
  for (let i = 0; i < 2 && parent; i++) {
    if (parent.closest('.they-live-wrapper')) break;
    if (blockedAds.has(parent)) return parent;
    if (parent.querySelector('[data-they-live-blocked]')) return element;
    if (matchesStrongSelector(parent) || hasAdPattern(parent)) return parent;
    parent = parent.parentElement;
  }

  return element;
}

function unwrapWrapper(wrapper) {
  const parent = wrapper.parentElement;
  if (!parent) {
    wrapper.remove();
    return;
  }

  const children = [...wrapper.childNodes];
  for (const child of children) {
    if (child instanceof HTMLElement && child.classList.contains('they-live-replacement')) {
      child.remove();
      continue;
    }
    parent.insertBefore(child, wrapper);
    if (child instanceof HTMLElement) {
      child.classList.remove('they-live-hidden-ad');
      delete child.dataset.theyLiveBlocked;
    }
  }
  wrapper.remove();
}

function cleanupAllTheyLiveArtifacts() {
  blockedAds.clear();

  document.querySelectorAll('.they-live-wrapper').forEach(unwrapWrapper);

  document.querySelectorAll('.they-live-replacement').forEach((overlay) => {
    overlay.remove();
  });

  document.querySelectorAll('.they-live-hidden-ad, [data-they-live-blocked]').forEach((element) => {
    element.classList.remove('they-live-hidden-ad');
    delete element.dataset.theyLiveBlocked;
  });

  document.querySelectorAll('[data-they-live-position-patched]').forEach((element) => {
    element.style.position = '';
    delete element.dataset.theyLivePositionPatched;
  });
}

function restoreAll() {
  cleanupAllTheyLiveArtifacts();
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

    const { width, height } = getElementSize(target);
    if (width < MIN_AD_WIDTH || height < MIN_AD_HEIGHT) return;

    const message = pickMessage();
    const overlay = buildOverlay(width, height, message);

    if (shouldUseInPlaceBlock(target)) {
      blockInPlace(target, parent, overlay, width, height, message);
    } else {
      blockWithWrapper(target, parent, overlay, width, height, message);
    }
  } catch {
    // Skip sandboxed or protected elements
  }
}

function forEachSelectorMatch(root, fn) {
  for (const selector of STRONG_AD_SELECTORS) {
    try {
      root.querySelectorAll(selector).forEach(fn);
    } catch {
      // invalid selector on some pages
    }
  }
}

function tryBlockElement(element) {
  if (isLikelyAd(element)) blockAd(element);
}

function scanSelectors(root = document) {
  if (!enabled) return;
  forEachSelectorMatch(root, tryBlockElement);
}

function scanHeuristic(root = document) {
  if (!enabled) return;
  root.querySelectorAll('iframe, ins').forEach(tryBlockElement);
}

function scanAddedRoot(root) {
  if (!enabled || !(root instanceof HTMLElement)) return;
  tryBlockElement(root);
  forEachSelectorMatch(root, tryBlockElement);
  root.querySelectorAll('iframe, ins').forEach(tryBlockElement);
}

function scanPage(full = false) {
  if (!enabled) return;
  scanSelectors();
  if (full) scanHeuristic();
}

function scheduleScan(full = false) {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => scanPage(full), SCAN_DEBOUNCE_MS);
}

function handleMutations(mutations) {
  if (!enabled) return;

  let scheduleQuick = false;

  for (const mutation of mutations) {
    if (mutation.type !== 'childList') continue;
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) {
        scanAddedRoot(node);
        scheduleQuick = true;
      }
    }
  }

  if (scheduleQuick) scheduleScan(false);
}

function startObserver() {
  if (observer) return;

  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  clearTimeout(scanTimer);
}

function activateBlocking() {
  messageCounter = 0;
  stopObserver();
  startObserver();
  scanPage(true);
  requestAnimationFrame(() => {
    if (enabled) scanPage(false);
  });
}

function setEnabled(value) {
  enabled = value !== false;
  document.documentElement.dataset.theyLiveActive = enabled ? 'true' : 'false';

  if (enabled) {
    activateBlocking();
  } else {
    stopObserver();
    restoreAll();
  }
}

function syncFromStorage() {
  chrome.storage.local.get(['enabled'], (result) => {
    setEnabled(result.enabled !== false);
  });
}

function registerListeners() {
  if (globalThis.__theyLiveListeners) return;
  globalThis.__theyLiveListeners = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
      setEnabled(changes.enabled.newValue !== false);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'TOGGLE') {
      setEnabled(message.enabled !== false);
      sendResponse({ ok: true });
    }
    return true;
  });

  window.addEventListener('resize', () => {
    if (enabled) scheduleScan(false);
  });
}

function boot() {
  registerListeners();
  syncFromStorage();
}

if (globalThis.__theyLiveBooted) {
  syncFromStorage();
} else {
  globalThis.__theyLiveBooted = true;
  boot();
}
