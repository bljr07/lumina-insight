/**
 * Throttle — Rate-limiting utility for Content Script event emission
 *
 * Ensures at most 1 invocation per interval. Uses a trailing-edge pattern:
 * if calls arrive during the throttle window, the latest args are queued
 * and fired after the interval elapses.
 *
 * @param {Function} fn - Function to throttle
 * @param {number} interval - Minimum ms between invocations
 * @returns {Function} Throttled function (fire-and-forget, returns undefined)
 */
export function throttle(fn, interval) {
  let lastCallTime = 0;
  let trailingTimer = null;
  let trailingArgs = null;

  return function throttled(...args) {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= interval) {
      // Enough time has passed — fire immediately
      lastCallTime = now;
      fn(...args);

      // Clear any pending trailing call
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
        trailingArgs = null;
      }
    } else {
      // Within throttle window — queue trailing call with latest args
      trailingArgs = args;

      if (trailingTimer === null) {
        const remaining = interval - elapsed;
        trailingTimer = setTimeout(() => {
          lastCallTime = Date.now();
          fn(...trailingArgs);
          trailingTimer = null;
          trailingArgs = null;
        }, remaining);
      }
    }
  };
}
