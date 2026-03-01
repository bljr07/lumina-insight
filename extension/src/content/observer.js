/**
 * IntersectionObserver Logic — Wires the ReReadDetector to the live DOM
 *
 * This module is responsible for setting up an IntersectionObserver that
 * watches specific DOM elements (like paragraphs or quiz cards) and reports
 * when they enter or leave the viewport to the ReReadDetector instance.
 */

let _observer = null;

/**
 * Initializes the IntersectionObserver and begins watching the provided elements.
 * 
 * @param {import('./sensors.js').ReReadDetector} detector 
 * @param {Element[]|NodeList} elements 
 */
export function initReReadObserver(detector, elements) {
  if (_observer) {
    _observer.disconnect();
  }

  if (!elements || elements.length === 0) return;

  // The callback fired when any observed element enters/exits the viewport
  const handleIntersection = (entries) => {
    for (const entry of entries) {
      const el = entry.target;
      const id = el.id || el.dataset.luminaId;

      if (!id) continue;

      if (entry.isIntersecting) {
        const text = (el.innerText || el.textContent || '').trim();
        detector.onElementSeen(id, text);
      } else {
        detector.onElementLeft(id);
      }
    }
  };

  // Configure observer with slightly padded margins so we count elements
  // slightly before they fully hit the screen edge.
  _observer = new IntersectionObserver(handleIntersection, {
    root: null, // viewport
    rootMargin: '50px',
    threshold: 0.1, // Trigger when 10% visible
  });

  // Attach auto-generated IDs and start observing
  let counter = 0;
  for (const el of elements) {
    if (!el.id && !el.dataset.luminaId) {
      el.dataset.luminaId = `lumina-node-${counter++}`;
    }
    _observer.observe(el);
  }
}

/**
 * Disconnects the active IntersectionObserver and cleans up.
 */
export function disconnectObserver() {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
}
