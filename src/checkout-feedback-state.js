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
  cancel = globalThis.clearTimeout
}) {
  if (!dialog?.dataset) throw new TypeError("checkout dialog with dataset is required");

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

  render(STATES.IDLE);

  return Object.freeze({
    state: () => state,
    loading: () => transition(STATES.LOADING),
    error: () => transition(STATES.ERROR),
    idle: () => transition(STATES.IDLE),
    destroy() {
      clearErrorTimer();
      delete dialog.dataset.checkoutFeedback;
    }
  });
}

export { STATES as CHECKOUT_FEEDBACK_STATES };
