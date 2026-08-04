const TEXT_FIELD_SELECTOR = [
  'input:not([type="button"]):not([type="checkbox"]):not([type="hidden"]):not([type="radio"]):not([type="reset"]):not([type="submit"])',
  "textarea"
].join(", ");

const mountedDocuments = new WeakMap();

function isTextField(node) {
  return typeof node?.matches === "function" && node.matches(TEXT_FIELD_SELECTOR);
}

function viewportBounds(viewport) {
  const height = Number(viewport?.height);
  const offsetTop = Number(viewport?.offsetTop || 0);
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(offsetTop)) return null;
  return { top: offsetTop, bottom: offsetTop + height };
}

function inertController() {
  return Object.freeze({ dispose() {} });
}

export function mountMobileInputVisibility({
  document,
  viewport = globalThis.visualViewport,
  windowTarget = globalThis,
  margin = 24
} = {}) {
  if (!document?.addEventListener) return inertController();
  const existing = mountedDocuments.get(document);
  if (existing) return existing;

  let activeField = null;
  let scheduled = false;
  const requestFrame = typeof windowTarget?.requestAnimationFrame === "function"
    ? (callback) => windowTarget.requestAnimationFrame(callback)
    : (callback) => callback();

  function ensureVisible() {
    if (!activeField || typeof activeField.getBoundingClientRect !== "function") return;
    const bounds = viewportBounds(viewport);
    if (!bounds) {
      activeField.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
      return;
    }

    const rect = activeField.getBoundingClientRect();
    const safeTop = bounds.top + margin;
    const safeBottom = bounds.bottom - margin;
    if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

    const fieldCenter = (rect.top + rect.bottom) / 2;
    const viewportCenter = (bounds.top + bounds.bottom) / 2;
    const top = fieldCenter - viewportCenter;
    if (!Number.isFinite(top) || Math.abs(top) < 1) return;

    if (typeof windowTarget?.scrollBy === "function") {
      windowTarget.scrollBy({ top, left: 0, behavior: "smooth" });
    } else {
      activeField.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  function scheduleVisibilityCheck() {
    if (scheduled) return;
    scheduled = true;
    requestFrame(() => {
      scheduled = false;
      ensureVisible();
    });
  }

  function handleFocusIn(event) {
    if (!isTextField(event.target)) return;
    activeField = event.target;
    scheduleVisibilityCheck();
  }

  function handleFocusOut(event) {
    if (event.target === activeField) activeField = null;
  }

  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("focusout", handleFocusOut);
  viewport?.addEventListener?.("resize", scheduleVisibilityCheck);
  viewport?.addEventListener?.("scroll", scheduleVisibilityCheck);
  windowTarget?.addEventListener?.("resize", scheduleVisibilityCheck);

  const controller = Object.freeze({
    dispose() {
      document.removeEventListener?.("focusin", handleFocusIn);
      document.removeEventListener?.("focusout", handleFocusOut);
      viewport?.removeEventListener?.("resize", scheduleVisibilityCheck);
      viewport?.removeEventListener?.("scroll", scheduleVisibilityCheck);
      windowTarget?.removeEventListener?.("resize", scheduleVisibilityCheck);
      activeField = null;
      mountedDocuments.delete(document);
    }
  });
  mountedDocuments.set(document, controller);
  return controller;
}
