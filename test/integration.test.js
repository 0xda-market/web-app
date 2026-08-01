import test from "node:test";
import assert from "node:assert/strict";
import { brokerStorageKey, mountBrokerWorkspace, mountMarketApp } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("mounts a complete transport document with catalog, session and currencies", async () => {
  const document = marketDocument();
  let bootstrapCalls = 0;
  const app = await mountMarketApp({
    document,
    host: {
      locale: () => "uk_UA",
      viewport: () => ({ width: 390, height: 844 }),
      onViewportChanged() {},
      selectionFeedback() {}
    },
    transport: {
      async bootstrap() { bootstrapCalls += 1; return bootstrapDocument(); },
      async quote() {},
      async acceptQuote() {},
      async refreshOrder() {}
    }
  });

  assert.equal(bootstrapCalls, 1);
  assert.equal(app.context().catalog.count, 2);
  assert.equal(app.context().session.role, "broker");
  assert.deepEqual(app.context().currencies, ["USDT", "UAH"]);
  assert.equal(document.elements.products.children.length, 2);
  assert.match(document.elements.status.textContent, /2 products/);
});

test("isolates broker drafts by verified subject and environment", () => {
  assert.notEqual(
    brokerStorageKey({ subject: "broker-a", environment: "development" }),
    brokerStorageKey({ subject: "broker-b", environment: "development" })
  );
  assert.notEqual(
    brokerStorageKey({ subject: "broker-a", environment: "development" }),
    brokerStorageKey({ subject: "broker-a", environment: "production" })
  );
  assert.throws(() => brokerStorageKey({ environment: "development" }), /subject/);
});

test("mounts broker workspace only from the explicit verified context", () => {
  const document = marketDocument();
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, value); }
  };
  const catalog = { products: bootstrapDocument().data };
  const workspace = mountBrokerWorkspace({
    document,
    catalog,
    session: { role: "broker", subject: "opaque-subject", environment: "development" },
    currencies: ["USDT", "UAH"],
    storage
  });

  assert.ok(workspace);
  assert.match(workspace.storageKey, /development:opaque-subject$/);
  assert.equal(document.main.children.at(-1), workspace.root);
  assert.equal(mountBrokerWorkspace({
    document,
    catalog,
    session: { role: "client" },
    currencies: ["USDT"],
    storage
  }), null);
});
