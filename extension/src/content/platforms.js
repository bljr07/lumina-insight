/**
 * Platform Detection — URL classification & DOM element discovery
 *
 * Identifies which learning platform the student is on and finds
 * platform-specific interactive elements (quiz buttons, poll options, etc.).
 */
import { PlatformType } from '@shared/constants.js';

// ─── Platform Registry ─────────────────────────────────────────────────────────

/**
 * Extensible registry of supported learning platforms.
 * Each entry defines:
 *   - name:     Canonical platform identifier
 *   - type:     PlatformType enum value
 *   - match:    Function(hostname) → boolean
 *   - selectors: CSS selectors for interactive quiz/poll elements
 */
export const PLATFORM_REGISTRY = [
  {
    name: 'phet.colorado.edu',
    type: PlatformType.PHYSICS_SIM,
    match: (hostname) =>
      hostname === 'phet.colorado.edu' ||
      hostname.endsWith('.phet.colorado.edu'),
    // PhET HTML5 sims often use specific ARIA roles or nested canvases. 
    // We target generic interactive slider inputs or generic buttons for tracking interactions
    selectors: ['input[type="range"]', 'button', '.phet-slider-thumb', '[role="slider"]'],
  },
  {
    name: 'kahoot.it',
    type: PlatformType.QUIZ,
    match: (hostname) =>
      hostname === 'kahoot.it' ||
      hostname.endsWith('.kahoot.it'),
    selectors: ['.answer-button', '[data-functional-selector="answer-button"]'],
  },
  {
    name: 'canvas',
    type: PlatformType.LMS_READING,
    match: (hostname) =>
      hostname.endsWith('.instructure.com') ||
      hostname === 'canvas.instructure.com',
    selectors: ['.quiz-question', '.question_text', '.answer', 'p'], // Added paragraphs for simpler text extraction
  },
  {
    name: 'wooclap',
    type: PlatformType.POLL,
    match: (hostname) =>
      hostname === 'app.wooclap.com' ||
      hostname === 'www.wooclap.com' ||
      hostname === 'wooclap.com',
    selectors: ['.poll-option', '[class*="poll-option"]', '.wc-answer'],
  },
];

// ─── Platform Detection ────────────────────────────────────────────────────────

/**
 * Detect the learning platform from a URL string.
 *
 * @param {string} urlString - Full URL of the current page
 * @returns {{ domain: string, type: string }} Platform context
 */
export function detectPlatform(urlString) {
  if (!urlString) {
    return { domain: 'unknown', type: PlatformType.UNKNOWN };
  }

  let hostname;
  try {
    const url = new URL(urlString);
    hostname = url.hostname.toLowerCase();
  } catch (err) {
    console.error('[Lumina] Failed to parse URL:', urlString, err);
    return { domain: 'unknown', type: PlatformType.UNKNOWN };
  }

  // Check against the registry
  for (const platform of PLATFORM_REGISTRY) {
    if (platform.match(hostname)) {
      return { domain: platform.name, type: platform.type };
    }
  }

  // Extract base domain for unknown sites
  const parts = hostname.split('.');
  const baseDomain =
    parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : hostname;

  return { domain: baseDomain || 'unknown', type: PlatformType.UNKNOWN };
}

// ─── Quiz Element Detection ────────────────────────────────────────────────────

/**
 * Find platform-specific interactive elements in the DOM.
 *
 * @param {Document} doc - The document to search
 * @param {string} platformName - Canonical platform name (e.g., 'kahoot.it')
 * @returns {Element[]} Array of matching DOM elements
 */
export function detectQuizElements(doc, platformName) {
  const platform = PLATFORM_REGISTRY.find((p) => p.name === platformName);

  if (!platform) {
    return [];
  }

  const elementSet = new Set();
  for (const selector of platform.selectors) {
    try {
      const matches = doc.querySelectorAll(selector);
      for (const el of matches) {
        elementSet.add(el);
      }
    } catch (err) {
      console.error('[Lumina] Invalid CSS selector:', selector, err);
    }
  }

  return [...elementSet];
}
