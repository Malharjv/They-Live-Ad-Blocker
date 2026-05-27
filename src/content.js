const DEFAULT_MESSAGE = 'CONSUME';

const MESSAGE_RULES = [
  {
    message: 'WATCH TV',
    keywords: [
      'stream', 'streaming', 'netflix', 'hulu', 'disney', 'disney+', 'hbo', 'max',
      'prime video', 'youtube', 'twitch', 'spotify', 'podcast', 'watch now',
      'binge', 'tv show', 'television', 'movie', 'series', 'episode', 'channel',
      'on demand', 'live tv', 'entertainment',
    ],
    domains: ['netflix.com', 'hulu.com', 'disneyplus', 'youtube.com', 'twitch.tv', 'spotify.com'],
  },
  {
    message: 'NO INDEPENDENT THOUGHT',
    keywords: [
      'politic', 'political', 'election', 'elect', 'vote', 'voting', 'ballot',
      'campaign', 'congress', 'senate', 'president', 'presidential', 'governor',
      'democrat', 'republican', 'parliament', 'minister', 'policy', 'legislation',
      'candidate', 'referendum', 'partisan', 'capitol', 'white house',
    ],
  },
  {
    message: 'DO NOT QUESTION AUTHORITY',
    keywords: [
      'authority', 'official', 'mandatory', 'law enforcement', 'military',
      'police', 'comply', 'compliance', 'regulation', 'government agency',
      ' homeland', 'national security', 'executive order', 'state department',
    ],
  },
  {
    message: 'OBEY',
    keywords: [
      'obey', 'comply', 'follow the rules', 'terms of service', 'community guidelines',
      'official statement', 'trusted source', 'certified', 'approved by',
    ],
  },
  {
    message: 'SUBMIT',
    keywords: [
      'subscribe', 'sign up', 'signup', 'join now', 'register', 'membership',
      'newsletter', 'create account', 'get started', 'free trial', 'enroll',
    ],
  },
  {
    message: 'MARRY AND REPRODUCE',
    keywords: [
      'dating', 'date night', 'marriage', 'marry', 'wedding', 'relationship',
      'soulmate', 'family planning', 'baby', 'pregnancy', 'tinder', 'match.com',
      'find love', ' singles',
    ],
  },
  {
    message: 'BUY',
    keywords: [
      'buy now', 'buy today', 'add to cart', 'checkout', 'purchase now',
      'order now', 'limited offer', 'free shipping', 'shop now', 'get yours',
    ],
  },
  {
    message: 'CONSUME',
    keywords: [
      'shop', 'shopping', 'store', 'marketplace', 'retail', 'ecommerce',
      'sale', 'discount', 'deal', 'coupon', 'brand', 'product', 'amazon',
      'ebay', 'walmart', 'target', 'shopify', 'consume', 'merchandise',
    ],
    domains: ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'shopify.com'],
  },
  {
    message: 'STAY ASLEEP',
    keywords: [
      'relax', 'unwind', 'comfort', 'self-care', 'wellness', 'meditation',
      'sleep', 'dream', 'ignore the noise', 'don\'t worry', 'stress free',
      'peace of mind', 'calm',
    ],
  },
  {
    message: 'CONFORM',
    keywords: [
      'trending', 'viral', 'popular', 'everyone is', 'join millions',
      'best seller', 'top rated', 'influencer', 'must have', 'don\'t miss out',
      'as seen on', 'celebrity',
    ],
  },
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

function extractAdContext(element) {
  const parts = [];

  const add = (value) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  };

  add(element.getAttribute('title'));
  add(element.getAttribute('aria-label'));
  add(element.getAttribute('alt'));
  add(element.id);
  if (typeof element.className === 'string') add(element.className);

  if (element.tagName === 'IFRAME') {
    add(element.getAttribute('src'));
    add(element.getAttribute('name'));
  }

  for (const attr of element.attributes) {
    if (/^(data-|aria-)/i.test(attr.name)) add(attr.value);
  }

  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  add(text.length <= 400 ? text : text.slice(0, 400));

  element.querySelectorAll('img, a, [aria-label], [title]').forEach((node) => {
    add(node.getAttribute('alt'));
    add(node.getAttribute('title'));
    add(node.getAttribute('aria-label'));
    if (node.tagName === 'A') add(node.getAttribute('href'));
  });

  let parent = element.parentElement;
  for (let depth = 0; depth < 2 && parent; depth++) {
    add(parent.getAttribute('aria-label'));
    add(parent.getAttribute('title'));
    for (const attr of parent.attributes) {
      if (/^data-(ad|campaign|advertiser|cta|title)/i.test(attr.name)) {
        add(attr.value);
      }
    }
    const parentText = (parent.textContent || '').replace(/\s+/g, ' ').trim();
    if (parentText.length <= 180) add(parentText);
    parent = parent.parentElement;
  }

  return parts.join(' ').toLowerCase();
}

function scoreRule(context, rule) {
  let score = 0;

  for (const keyword of rule.keywords) {
    if (context.includes(keyword)) {
      score += keyword.length + 2;
    }
  }

  if (rule.domains) {
    for (const domain of rule.domains) {
      if (context.includes(domain)) score += 12;
    }
  }

  if (rule.patterns) {
    for (const pattern of rule.patterns) {
      if (pattern.test(context)) score += 10;
    }
  }

  return score;
}

function pickMessage(element) {
  const context = extractAdContext(element);
  if (!context) return DEFAULT_MESSAGE;

  let bestMessage = DEFAULT_MESSAGE;
  let bestScore = 0;

  for (const rule of MESSAGE_RULES) {
    const score = scoreRule(context, rule);
    if (score > bestScore) {
      bestScore = score;
      bestMessage = rule.message;
    }
  }

  return bestMessage;
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
  if (element.dataset.theyLiveBlocked === 'true') return false;
  if (element.querySelector('[data-they-live-blocked]')) return false;

  for (const blocked of blockedAds.keys()) {
    if (blocked !== element && blocked.contains(element)) return false;
  }

  const tag = element.tagName;
  if (tag === 'BODY' || tag === 'HTML' || tag === 'MAIN' || tag === 'ARTICLE') return false;

  const { width, height } = getElementSize(element);

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
    if (blockedAds.has(parent)) return parent;
    if (parent.querySelector('[data-they-live-blocked]')) return element;
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

function activateBlocking() {
  stopObserver();
  startObserver();
  scanPage();
  requestAnimationFrame(() => {
    if (enabled) scanPage();
  });
  setTimeout(() => {
    if (enabled) scanPage();
  }, 150);
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
    if (enabled) scheduleScan();
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
