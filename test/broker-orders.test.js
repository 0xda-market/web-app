import test from "node:test";
import assert from "node:assert/strict";
import { mountBrokerOrders } from "../src/broker-orders.js";
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
  await mounted.list.children[0].children.at(-1).dispatch("click");
  assert.deepEqual(calls[1], ["accept", { orderId: "order-1", version: 0 }]);
  assert.equal(mounted.getOrders()[0].status, "accepted");
  await mounted.list.children[0].children.at(-1).dispatch("click");
  assert.deepEqual(calls[2], ["complete", { orderId: "order-1", version: 1 }]);
  assert.equal(mounted.getOrders()[0].status, "completed");
});

test("does not mount broker orders for a client role", async () => {
  assert.equal(await mountBrokerOrders({
    document: marketDocument(),
    container: { append() {} },
    session: { role: "client" },
    transport: {}
  }), null);
});
