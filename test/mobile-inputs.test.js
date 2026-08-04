import test from "node:test";
import assert from "node:assert/strict";
import { mountMobileInputVisibility } from "../src/index.js";

class EventSource {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || new Set();
    callbacks.add(callback);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback(event);
  }
}

test("centers a focused field after the visual viewport shrinks for a mobile keyboard", () => {
  const document = new EventSource();
  const viewport = Object.assign(new EventSource(), { height: 800, offsetTop: 0 });
  const windowTarget = Object.assign(new EventSource(), {
    requestAnimationFrame(callback) { callback(); },
    scrollBy(options) { this.scrolls.push(options); },
    scrolls: []
  });
  const field = {
    matches(selector) { return selector.includes("input"); },
    getBoundingClientRect() { return { top: 600, bottom: 640 }; }
  };

  const mounted = mountMobileInputVisibility({ document, viewport, windowTarget });
  document.dispatch("focusin", { target: field });
  assert.equal(windowTarget.scrolls.length, 0);

  viewport.height = 400;
  viewport.dispatch("resize");
  assert.deepEqual(windowTarget.scrolls, [{ top: 420, left: 0, behavior: "smooth" }]);

  document.dispatch("focusout", { target: field });
  viewport.dispatch("resize");
  assert.equal(windowTarget.scrolls.length, 1);
  mounted.dispose();
});

test("falls back to scrollIntoView when VisualViewport is unavailable", () => {
  const document = new EventSource();
  const windowTarget = new EventSource();
  const calls = [];
  windowTarget.requestAnimationFrame = (callback) => callback();
  const field = {
    matches(selector) { return selector.includes("textarea"); },
    getBoundingClientRect() { return { top: 500, bottom: 560 }; },
    scrollIntoView(options) { calls.push(options); }
  };

  mountMobileInputVisibility({ document, viewport: null, windowTarget });
  document.dispatch("focusin", { target: field });

  assert.deepEqual(calls, [{ behavior: "smooth", block: "center", inline: "nearest" }]);
});

test("dismisses a focused field from a confirmation control above the keyboard", () => {
  const document = new EventSource();
  const viewport = Object.assign(new EventSource(), { height: 800, offsetTop: 0 });
  const windowTarget = Object.assign(new EventSource(), {
    innerHeight: 800,
    requestAnimationFrame(callback) { callback(); }
  });
  const confirmationControl = Object.assign(new EventSource(), { hidden: true, style: {} });
  let blurCount = 0;
  const field = {
    matches(selector) { return selector.includes("input"); },
    getBoundingClientRect() { return { top: 200, bottom: 240 }; },
    blur() { blurCount += 1; }
  };

  const mounted = mountMobileInputVisibility({
    document,
    viewport,
    windowTarget,
    confirmationControl
  });
  document.dispatch("focusin", { target: field });

  assert.equal(confirmationControl.hidden, false);
  assert.equal(confirmationControl.style.top, "800px");

  viewport.height = 420;
  viewport.dispatch("resize");
  assert.equal(confirmationControl.style.top, "420px");

  let focusPreserved = false;
  confirmationControl.dispatch("pointerdown", { preventDefault() { focusPreserved = true; } });
  assert.equal(focusPreserved, true);

  confirmationControl.dispatch("click");
  assert.equal(blurCount, 1);
  assert.equal(confirmationControl.hidden, true);

  mounted.dispose();
});
