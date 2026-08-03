import test from "node:test";
import assert from "node:assert/strict";
import { mountMarketApp, paymentPendingMessage } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("formats authoritative payment state in English and Ukrainian", () => {
  const order = {
    attributes: {
      payment: {
        amount: "25",
        currency: "USDT",
        expires_at: "2026-08-03T18:00:00Z"
      }
    }
  };

  assert.match(paymentPendingMessage(order, "en_US"), /25 USDT/);
  assert.match(paymentPendingMessage(order, "en_US"), /Waiting for payment confirmation/);
  assert.match(paymentPendingMessage(order, "uk_UA"), /25 USDT/);
  assert.match(paymentPendingMessage(order, "uk_UA"), /Очікуємо підтвердження платежу/);
});

test("keeps payment-pending checkout refreshable without a browser confirmation action", async () => {
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
            expires_at: "2026-08-03T18:00:00Z",
            quantity: payload.quantity,
            total_price_usdt: "25",
            currency: "USDT"
          }
        };
      },
      async acceptQuote(payload) {
        calls.push(["accept", payload]);
        return {
          type: "order",
          id: "order-1",
          attributes: {
            status: "payment_pending",
            inventory_status: "payment_pending",
            payment_status: "pending",
            payment: {
              status: "pending",
              amount: "25",
              currency: "USDT",
              expires_at: "2026-08-03T18:00:00Z"
            }
          }
        };
      },
      async refreshOrder(payload) {
        calls.push(["refresh", payload]);
        return {
          type: "order",
          id: payload.orderId,
          attributes: {
            status: "pending",
            inventory_status: "committed",
            payment_status: "confirmed",
            payment: { status: "confirmed", amount: "25", currency: "USDT" }
          }
        };
      }
    }
  });

  document.elements.products.children[0].dispatch("click");
  await document.elements["checkout-action"].dispatch("click");
  await document.elements["checkout-action"].dispatch("click");

  assert.match(document.elements["dialog-status"].textContent, /Очікуємо підтвердження платежу/);
  assert.match(document.elements["dialog-status"].textContent, /25 USDT/);
  assert.equal(document.elements["checkout-action"].disabled, false);

  await document.elements["checkout-action"].dispatch("click");
  assert.deepEqual(calls.map(([operation]) => operation), ["quote", "accept", "refresh"]);
  assert.equal(calls[2][1].orderId, "order-1");
  assert.match(document.elements["dialog-status"].textContent, /обробляється/);
});
