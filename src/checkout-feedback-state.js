const STATES = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  ERROR: "error"
});

const DEFAULT_ERROR_DURATION_MS = 2200;

export function createCheckoutFeedbackState({
  dialog,
  errorDurationMs = DEFAULT_ERROR_DURATION_MS,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
  Observer = globalThis.MutationObserver
}) {
  if (!dialog?.dataset) throw new TypeError("checkout dialog with dataset is required");
  if (typeof Observer !== "function") throw new TypeError("MutationObserver is required");

  let state = STATES.IDLE;
  let errorTimer;

  function clearErrorTimer() {
    if (errorTimer === undefined) return;
    cancel(errorTimer);
    errorTimer = undefined;
  }

  function render(nextState) {
    state = nextState;
    dialog.dataset.checkoutFeedback = nextState;
  }

  function transition(nextState) {
    if (!Object.values(STATES).includes(nextState)) {
      throw new TypeError(`unsupported checkout feedback state: ${nextState}`);
    }

    clearErrorTimer();
    render(nextState);

    if (nextState === STATES.ERROR) {
      errorTimer = schedule(() => {
        errorTimer = undefined;
        render(STATES.IDLE);
      }, errorDurationMs);
    }
  }

  const observer = new Observer(() => {
    if (dialog.dataset.loading === "true") {
      transition(STATES.LOADING);
    } else if (state === STATES.LOADING) {
      transition(STATES.IDLE);
    }
  });

  observer.observe(dialog, { attributes: true, attributeFilter: ["data-loading"] });
  render(STATES.IDLE);

  return Object.freeze({
    state: () => state,
    loading: () => transition(STATES.LOADING),
    error: () => transition(STATES.ERROR),
    idle: () => transition(STATES.IDLE),
    destroy() {
      clearErrorTimer();
      observer.disconnect();
      delete dialog.dataset.checkoutFeedback;
    }
  });
}

export function withCheckoutFeedback(transport, { dialog, feedback }) {
  if (!transport || typeof transport !== "object") throw new TypeError("transport is required");
  if (!dialog) throw new TypeError("checkout dialog is required");
  if (!feedback?.error) throw new TypeError("checkout feedback controller is required");

  return new Proxy(transport, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;

      return async (...arguments_) => {
        try {
          return await value.apply(target, arguments_);
        } catch (error) {
          if (dialog.open) feedback.error();
          throw error;
        }
      };
    }
  });
}

export { STATES as CHECKOUT_FEEDBACK_STATES };
