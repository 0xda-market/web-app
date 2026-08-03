import test from "node:test";
import assert from "node:assert/strict";
import { brokerStorageKey, mountBrokerWorkspace, mountMarketApp } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("mounts a complete transport document with catalog, locale, session and currencies", async () => {
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
  assert.equal(app.context().locale, "uk_UA");
  assert.equal(app.context().session.role, "broker");
  assert.deepEqual(app.context().currencies, ["USDT", "UAH"]);
  assert.equal(document.elements.products.children.length, 2);
  assert.equal(document.elements.status.textContent, "2 товари · 1/1");
});

test("retains the legacy draft key contract without using browser storage", () => {
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

test("mounts broker workspace and loads durable listings from transport", async () => {
  const document = marketDocument();
  const calls = [];
  const transport = {
    async listBrokerListings() {
      calls.push(["list"]);
      return [{
        type: "broker_listing",
        id: "listing-1",
        attributes: {
          sku: "product_1", quantity: "2.5", price_amount: "12.25", currency: "USDT",
          status: "active", version: 0, updated_at: "2026-08-01T12:00:00Z"
        }
      }];
    },
    async createBrokerListing(payload) { calls.push(["create", payload]); },
    async updateBrokerListing(payload) { calls.push(["update", payload]); },
    async withdrawBrokerListing(payload) { calls.push(["withdraw", payload]); }
  };
  const catalog = { products: bootstrapDocument().data };
  const workspace = await mountBrokerWorkspace({
    document,
    catalog,
    session: { role: "broker", subject: "opaque-subject", environment: "development" },
    currencies: ["USDT", "UAH"],
    transport
  });

  assert.ok(workspace);
  assert.equal(workspace.getListings()[0].id, "listing-1");
  assert.deepEqual(calls, [["list"]]);
  assert.equal(document.main.children.at(-1), workspace.root);
  assert.equal(await mountBrokerWorkspace({
    document,
    catalog,
    session: { role: "client" },
    currencies: ["USDT"],
    transport
  }), null);
});

test("publishes and withdraws listings with exact decimal strings", async () => {
  const document = marketDocument();
  const calls = [];
  const transport = {
    async listBrokerListings() { return []; },
    async createBrokerListing(payload) {
      calls.push(["create", payload]);
      return {
        type: "broker_listing", id: "listing-2",
        attributes: { sku: payload.sku, quantity: payload.quantity, price_amount: payload.priceAmount, currency: payload.currency, status: "active", version: 0 }
      };
    },
    async updateBrokerListing() {},
    async withdrawBrokerListing(payload) {
      calls.push(["withdraw", payload]);
      return { type: "broker_listing", id: payload.listingId, attributes: { status: "withdrawn", version: 1 } };
    }
  };
  const workspace = await mountBrokerWorkspace({
    document,
    catalog: { products: bootstrapDocument().data },
    session: { role: "admin", subject: "admin", environment: "development" },
    currencies: ["USDT"],
    transport
  });
  const [, , form] = workspace.root.children;
  const controls = form.children.map((label) => label.children?.[1]).filter(Boolean);
  const [product, quantity, amount, currency] = controls;
  product.value = "product_1";
  quantity.value = "0.125000000001";
  amount.value = "65000.12345678";
  currency.value = "USDT";
  await form.dispatch("submit");

  assert.deepEqual(calls[0], ["create", {
    sku: "product_1", quantity: "0.125000000001", priceAmount: "65000.12345678", currency: "USDT"
  }]);
  assert.equal(workspace.getListings().length, 1);
  const card = workspace.list.children[0];
  await card.children.at(-1).dispatch("click");
  assert.deepEqual(calls[1], ["withdraw", { listingId: "listing-2", version: 0 }]);
  assert.equal(workspace.getListings().length, 0);
});
