/**
 * Lightweight confetti fallback with no external dependency.
 * Safe no-op on environments without DOM/canvas.
 */
export function fireConfetti() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.position = "fixed";
    container.style.inset = "0";
    container.style.pointerEvents = "none";
    container.style.zIndex = "9999";
    document.body.appendChild(container);

    for (let i = 0; i < 40; i += 1) {
      const piece = document.createElement("div");
      piece.style.position = "absolute";
      piece.style.width = "8px";
      piece.style.height = "12px";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.top = "-12px";
      piece.style.opacity = "0.9";
      piece.style.borderRadius = "2px";
      piece.style.background = `hsl(${Math.floor(Math.random() * 360)} 90% 60%)`;
      piece.style.transform = `rotate(${Math.floor(Math.random() * 360)}deg)`;
      piece.style.transition = "transform 1200ms ease-out, top 1200ms ease-out, opacity 1200ms ease-out";
      container.appendChild(piece);

      requestAnimationFrame(() => {
        piece.style.top = `${70 + Math.random() * 40}%`;
        piece.style.transform = `translateX(${(Math.random() - 0.5) * 160}px) rotate(${360 + Math.floor(Math.random() * 360)}deg)`;
        piece.style.opacity = "0";
      });
    }

    setTimeout(() => {
      container.remove();
    }, 1400);
  } catch {
    // Swallow visual-effect errors to avoid impacting app flow.
  }
}
