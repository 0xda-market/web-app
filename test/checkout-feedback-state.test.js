import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_FEEDBACK_STATES,
  createCheckoutFeedbackState,
  withCheckoutFeedback
} from "../src/checkout-feedback-state.js";

class FakeObserver {
  constructor(callback) {
    this.callback = callback;
    FakeObserver.instance = this;
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback();
  }
}

function dialog() {
  return {
    dataset: {},
    open: true,
    setAttribute(name, value) {
      if (name === "data-loading") this.dataset.loading = String(value);
    },
    removeAttribute(name) {
      if (name === "data-loading") delete this.dataset.loading;
    }
  };
}

test("checkout feedback has exactly idle, loading and error states", () => {
  assert.deepEqual(Object.values(CHECKOUT_FEEDBACK_STATES), ["idle", "loading", "error"]);
});

test("data-loading value drives loading and returns to idle", () => {
  const target = dialog();
  const feedback = createCheckoutFeedbackState({ dialog: target, Observer: FakeObserver });

  assert.equal(feedback.state(), "idle");
  assert.equal(target.dataset.checkoutFeedback, "idle");

  target.setAttribute("data-loading", "true");
  FakeObserver.instance.trigger();
  assert.equal(feedback.state(), "loading");

  target.setAttribute("data-loading", "false");
  FakeObserver.instance.trigger();
  assert.equal(feedback.state(), "idle");
});

test("error survives pending cleanup and remains transient", () => {
  const target = dialog();
  let callback;
  const feedback = createCheckoutFeedbackState({
    dialog: target,
    Observer: FakeObserver,
    schedule(fn) {
      callback = fn;
      return 7;
    }
  });

  target.setAttribute("data-loading", "true");
  FakeObserver.instance.trigger();
  assert.equal(feedback.state(), "loading");

  feedback.error();
  assert.equal(feedback.state(), "error");

  target.setAttribute("data-loading", "false");
  FakeObserver.instance.trigger();
  assert.equal(feedback.state(), "error");

  callback();
  assert.equal(feedback.state(), "idle");
});

test("error is transient and a new loading state cancels its timer", () => {
  const target = dialog();
  let callback;
  let cancelled;
  const feedback = createCheckoutFeedbackState({
    dialog: target,
    Observer: FakeObserver,
    schedule(fn) {
      callback = fn;
      return 7;
    },
    cancel(id) {
      cancelled = id;
    }
  });

  feedback.error();
  assert.equal(feedback.state(), "error");
  feedback.loading();
  assert.equal(cancelled, 7);
  assert.equal(feedback.state(), "loading");

  callback();
  assert.equal(feedback.state(), "idle");
});

test("transport failures surface error feedback only while checkout is open", async () => {
  const target = dialog();
  let errors = 0;
  const feedback = { error() { errors += 1; } };
  const transport = withCheckoutFeedback({
    async quote() { throw new Error("boom"); }
  }, { dialog: target, feedback });

  await assert.rejects(() => transport.quote(), /boom/);
  assert.equal(errors, 1);

  target.open = false;
  await assert.rejects(() => transport.quote(), /boom/);
  assert.equal(errors, 1);
});
