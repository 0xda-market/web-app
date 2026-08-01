import test from "node:test";
import assert from "node:assert/strict";
import { runtimeConfig } from "../src/runtime.js";

test("uses canonical VPS route defaults", () => {
  delete globalThis.__ZERO_X_DA_MARKET__;
  const config = runtimeConfig({ origin: "https://0xda-market.nilx.one" });
  assert.equal(config.apiBaseUrl, "/bot/webapp");
  assert.equal(config.webAppCoreUrl, "https://0xda-market.nilx.one/webapp-core/index.js");
});

test("normalizes deployment overrides", () => {
  globalThis.__ZERO_X_DA_MARKET__ = { apiBaseUrl: "/custom/", webAppCoreUrl: "/assets/core.js" };
  const config = runtimeConfig({ origin: "https://example.test" });
  assert.equal(config.apiBaseUrl, "/custom");
  assert.equal(config.webAppCoreUrl, "https://example.test/assets/core.js");
  delete globalThis.__ZERO_X_DA_MARKET__;
});
