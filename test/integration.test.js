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
  const recipientField = document.elements["checkout-dialog"].children.at(-1);
  assert.equal(recipientField.className, "checkout-recipient-field");
});

test("requests and accepts a single-unit quote with the recipient contract", async () => {
  const document = marketDocument();
  const calls = [];
  await mountMarketApp({
    document,
    host: {
      locale: () => "uk_UA",
      viewport: () => ({ width: 390, height: 844 }),
      onViewportChanged() {},
      selectionFeedback() {}
    },
    transport: {
      async bootstrap() { return bootstrapDocument({ role: "client", count: 1 }); },
      async quote(payload) {
        calls.push(["quote", payload]);
        return {
          type: "quote",
          id: "quote-1",
          attributes: {
            expires_at: "2026-08-03T13:00:00Z",
            quantity: payload.quantity,
            total_price_usdt: "3",
            currency: "USDT"
          }
        };
      },
      async acceptQuote(payload) {
        calls.push(["accept", payload]);
        return { type: "order", id: "order-1", attributes: { status: "accepted", inventory_status: "committed" } };
      },
      async refreshOrder() {}
    }
  });

  document.elements.products.children[0].dispatch("click");
  await document.elements["checkout-action"].dispatch("click");
  assert.deepEqual(calls[0], ["quote", {
    sku: "product_1", quantity: "1", recipient: null, locale: "uk_UA"
  }]);
  assert.match(document.elements["dialog-status"].textContent, /1 од\. · 3 USDT/);

  await document.elements["checkout-action"].dispatch("click");
  assert.deepEqual(calls[1], ["accept", { quoteId: "quote-1" }]);
});

test("makes the checkout section pending while a quote POST is in flight", async () => {
  const document = marketDocument();
  let resolveQuote;
  await mountMarketApp({
    document,
    host: {
      locale: () => "uk_UA",
      viewport: () => ({ width: 390, height: 844 }),
      onViewportChanged() {},
      selectionFeedback() {}
    },
    transport: {
      async bootstrap() { return bootstrapDocument({ role: "client", count: 1 }); },
      async quote(payload) {
        return new Promise((resolve) => {
          resolveQuote = () => resolve({
            type: "quote",
            id: "quote-1",
            attributes: {
              expires_at: "2026-08-03T13:00:00Z",
              quantity: payload.quantity,
              total_price_usdt: "1",
              currency: "USDT"
            }
          });
        });
      },
      async acceptQuote() {},
      async refreshOrder() {}
    }
  });

  document.elements.products.children[0].dispatch("click");
  document.elements["checkout-action"].dispatch("click");
  await Promise.resolve();
  assert.equal(document.elements["checkout-dialog"].inert, true);
  assert.equal(document.elements["checkout-dialog"].attributes["aria-busy"], "true");
  assert.match(document.elements["dialog-status"].textContent, /Резервуємо доступний залишок/);

  resolveQuote();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(document.elements["checkout-dialog"].inert, false);
  assert.equal(document.elements["checkout-dialog"].attributes["aria-busy"], "false");
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

test("mounts broker workspace and loads durable finite inventory from transport", async () => {
  const document = marketDocument();
  const calls = [];
  const transport = {
    async listBrokerListings() {
      calls.push(["list"]);
      return [{
        type: "broker_listing",
        id: "listing-1",
        attributes: {
          sku: "product_1",
          quantity: "2.5",
          available_quantity: "1.5",
          reserved_quantity: "0.5",
          sold_quantity: "0.5",
          price_amount: "12.25",
          currency: "USDT",
          status: "active",
          routing: {
            execution_status: "executable",
            status: "best",
            estimated_order_share: "0.7",
            eligible_supply_count: 3,
            sale_price_usdt: "15",
            maximum_ask: { amount: "14.55", currency: "USDT" }
          },
          version: 2,
          updated_at: "2026-08-01T12:00:00Z"
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
    transport,
    locale: "uk_UA"
  });

  assert.ok(workspace);
  assert.equal(workspace.getListings()[0].id, "listing-1");
  assert.equal(workspace.getListings()[0].availableQuantity, "1.5");
  assert.equal(workspace.getListings()[0].routing.status, "best");
  assert.deepEqual(calls, [["list"]]);

  const [card] = workspace.list.children;
  assert.equal(card.attributes["data-listing-status"], "active");
  assert.equal(card.children[0].children[1].textContent, "Активне");
  assert.equal(card.children[1].children[1].textContent, "12.25 USDT");
  const routing = card.children[2];
  assert.equal(routing.attributes["data-routing-status"], "best");
  assert.equal(routing.attributes["data-execution-status"], "executable");
  assert.equal(routing.children[0].children[0].textContent, "Найкраща пропозиція");
  assert.match(routing.children[0].children[1].textContent, /70/);
  assert.equal(routing.children[1].children[0].children[1].textContent, "15 USDT");
  assert.equal(routing.children[1].children[1].children[1].textContent, "14.55 USDT");
  const inventory = card.children[3];
  assert.equal(inventory.attributes["data-inventory-owner"], "server");
  assert.match(inventory.attributes["aria-label"], /Доступно 1.5/);
  assert.match(inventory.attributes["aria-label"], /Зарезервовано 0.5/);
  assert.match(inventory.attributes["aria-label"], /Продано 0.5/);
  assert.deepEqual(
    inventory.children.map((balance) => [
      balance.attributes["data-balance"],
      balance.children[1].textContent
    ]),
    [["total", "2.5"], ["available", "1.5"], ["reserved", "0.5"], ["sold", "0.5"]]
  );
  assert.deepEqual(
    card.children[4].children.map((action) => action.attributes["data-listing-action"]),
    ["edit", "withdraw"]
  );
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
        attributes: {
          sku: payload.sku,
          quantity: payload.quantity,
          available_quantity: payload.quantity,
          reserved_quantity: "0",
          sold_quantity: "0",
          price_amount: payload.priceAmount,
          currency: payload.currency,
          status: "active",
          version: 0
        }
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
  assert.equal(quantity.type, "number");
  assert.equal(quantity.attributes.inputmode, "decimal");
  assert.equal(amount.type, "number");
  assert.equal(amount.attributes.inputmode, "decimal");
  product.value = "product_1";
  quantity.value = "0.125000000001";
  amount.value = "65000.12345678";
  currency.value = "USDT";
  await form.dispatch("submit");

  assert.deepEqual(calls[0], ["create", {
    sku: "product_1", quantity: "0.125000000001", priceAmount: "65000.12345678", currency: "USDT"
  }]);
  assert.equal(workspace.getListings().length, 1);
  assert.equal(workspace.getListings()[0].availableQuantity, "0.125000000001");
  const card = workspace.list.children[0];
  await card.children.at(-1).children.at(-1).dispatch("click");
  assert.deepEqual(calls[1], ["withdraw", { listingId: "listing-2", version: 0 }]);
  assert.equal(workspace.getListings().length, 0);
});

test("makes the broker section pending while a listing POST is in flight", async () => {
  const document = marketDocument();
  let resolveCreate;
  const transport = {
    async listBrokerListings() { return []; },
    async createBrokerListing(payload) {
      return new Promise((resolve) => {
        resolveCreate = () => resolve({
          type: "broker_listing",
          id: "listing-2",
          attributes: {
            sku: payload.sku,
            quantity: payload.quantity,
            available_quantity: payload.quantity,
            reserved_quantity: "0",
            sold_quantity: "0",
            price_amount: payload.priceAmount,
            currency: payload.currency,
            status: "active",
            version: 0
          }
        });
      });
    },
    async updateBrokerListing() {},
    async withdrawBrokerListing() {}
  };
  const workspace = await mountBrokerWorkspace({
    document,
    catalog: { products: bootstrapDocument().data },
    session: { role: "broker", subject: "broker", environment: "development" },
    currencies: ["USDT"],
    transport
  });
  const controls = workspace.form.children.map((label) => label.children?.[1]).filter(Boolean);
  const [product, quantity, amount, currency] = controls;
  product.value = "product_1";
  quantity.value = "1";
  amount.value = "10";
  currency.value = "USDT";

  const submission = workspace.form.dispatch("submit");
  await Promise.resolve();
  assert.equal(workspace.root.inert, true);
  assert.equal(workspace.root.attributes["aria-busy"], "true");
  assert.match(workspace.status.textContent, /Publishing listing/);
  resolveCreate();
  await submission;
  assert.equal(workspace.root.inert, false);
  assert.equal(workspace.root.attributes["aria-busy"], "false");
});
