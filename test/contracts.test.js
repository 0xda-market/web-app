import test from "node:test";
import assert from "node:assert/strict";
import { assertHost, assertTransport, normalizeLocale } from "../src/contracts.js";

test("normalizes supported locales", () => {
  assert.equal(normalizeLocale("uk-UA"), "uk_UA");
  assert.equal(normalizeLocale("de"), "de_DE");
  assert.equal(normalizeLocale("unknown"), "en_US");
});

test("accepts channel-neutral host contract", () => {
  const host = {
    locale() {}, viewport() {}, onViewportChanged() {}, selectionFeedback() {}
  };
  assert.equal(assertHost(host), host);
  assert.throws(() => assertHost({}), /host.locale/);
});

test("accepts channel-neutral transport contract", () => {
  const transport = {
    bootstrap() {}, quote() {}, acceptQuote() {}, refreshOrder() {}
  };
  assert.equal(assertTransport(transport), transport);
  assert.throws(() => assertTransport({}), /transport.bootstrap/);
});
