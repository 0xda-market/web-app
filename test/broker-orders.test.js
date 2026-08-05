import test from "node:test";
import assert from "node:assert/strict";
import { mountBrokerOrders, orderLifecycle } from "../src/broker-orders.js";
import { marketDocument } from "./helpers.js";

function order(overrides = {}) {
  return {
    type: "broker_order",
    id: "order-1",
    attributes: {
      status: "requested",
      order_status: "payment_pending",
      payment_status: "pending",
      sku: "premium_3m",
      product_name: "Telegram Premium 3 months",
      quantity: "1",
      client_total_price_usdt: "15",
      currency: "USDT",
      version: 0,
      ...overrides
    }
  };
}

test("shows broker-owned requests and follows accept then complete states", async () => {
  const document = marketDocument();
  const calls = [];
  const root = document.createElement("section");
  const mounted = await mountBrokerOrders({
    document,
    container: root,
    session: { role: "broker" },
    locale: "uk_UA",
    transport: {
      async listBrokerOrders() { calls.push(["list"]); return [order()]; },
      async acceptBrokerOrder(payload) {
        calls.push(["accept", payload]);
        return order({ status: "accepted", payment_status: "confirmed", version: 1 });
      },
      async completeBrokerOrder(payload) {
        calls.push(["complete", payload]);
        return order({ status: "completed", order_status: "succeeded", payment_status: "confirmed", version: 2 });
      }
    }
  });

  assert.equal(mounted.getOrders().length, 1);
  assert.match(mounted.root.children[0].textContent, /Замовлення клієнтів/);

  const requested = mounted.list.children[0];
  assert.equal(requested.attributes["data-order-status"], "requested");
  assert.deepEqual(
    requested.children[1].children.map((step) => step.attributes["data-lifecycle-state"]),
    ["complete", "current", "upcoming", "upcoming", "upcoming"]
  );
  assert.equal(requested.children[2].children[0].attributes["data-order-action"], "accept");

  await requested.children[2].children[0].dispatch("click");
  assert.deepEqual(calls[1], ["accept", { orderId: "order-1", version: 0 }]);
  assert.equal(mounted.getOrders()[0].status, "accepted");

  const accepted = mounted.list.children[0];
  assert.deepEqual(
    accepted.children[1].children.map((step) => step.attributes["data-lifecycle-state"]),
    ["complete", "complete", "complete", "current", "upcoming"]
  );
  await accepted.children[2].children[0].dispatch("click");
  assert.deepEqual(calls[2], ["complete", { orderId: "order-1", version: 1 }]);
  assert.equal(mounted.getOrders()[0].status, "completed");

  const completed = mounted.list.children[0];
  assert.deepEqual(
    completed.children[1].children.map((step) => step.attributes["data-lifecycle-state"]),
    ["complete", "complete", "complete", "complete", "complete"]
  );
  assert.equal(completed.children[2].children.length, 0);
});

test("keeps the lifecycle rail whole while payment is pending or has failed", () => {
  assert.deepEqual(
    orderLifecycle({ status: "accepted", orderStatus: "payment_pending", paymentStatus: "pending" }),
    [
      { step: "requested", state: "complete" },
      { step: "accepted", state: "complete" },
      { step: "payment", state: "current" },
      { step: "fulfillment", state: "upcoming" },
      { step: "completion", state: "upcoming" }
    ]
  );
  assert.deepEqual(
    orderLifecycle({ status: "accepted", orderStatus: "failed", paymentStatus: "failed" }).map((entry) => entry.state),
    ["complete", "complete", "failed", "upcoming", "failed"]
  );
  assert.deepEqual(
    orderLifecycle({}).map((entry) => entry.state),
    ["complete", "current", "upcoming", "upcoming", "upcoming"]
  );
});

test("does not mount broker orders for a client role", async () => {
  assert.equal(await mountBrokerOrders({
    document: marketDocument(),
    container: { append() {} },
    session: { role: "client" },
    transport: {}
  }), null);
});
