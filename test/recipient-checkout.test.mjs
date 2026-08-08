import test from "node:test";
import assert from "node:assert/strict";
import { CheckoutController, purchasePolicy } from "../src/engine.js";
import { checkoutRecipientCopy } from "../src/checkout-recipient-i18n.js";

const product = Object.freeze({
  id: "premium_3m",
  attributes: {
    metadata: {
      family: "telegram_premium",
      purchase: {
        quantity_mode: "single",
        recipient: { provider: "telegram", modes: ["self", "username"] }
      }
    }
  }
});

test("single recipient product always quotes exactly one unit", async () => {
  let captured;
  const controller = new CheckoutController({
    quote: async (sku, quantity, recipient) => {
      captured = { sku, quantity, recipient };
      return { id: "q1", attributes: { expires_at: new Date().toISOString() } };
    },
    accept: async () => ({ id: "o1", attributes: { status: "payment_pending" } }),
    refresh: async () => ({ id: "o1", attributes: { status: "succeeded" } })
  });

  await controller.quote(product, "99", { mode: "username", username: "@recipient" });

  assert.deepEqual(captured, {
    sku: "premium_3m",
    quantity: "1",
    recipient: { mode: "username", username: "recipient" }
  });
  assert.equal(controller.state.quantity, "1");
});

test("purchase policy exposes server-defined recipient modes", () => {
  assert.deepEqual(purchasePolicy(product), {
    single: true,
    recipient: { provider: "telegram", modes: ["self", "username"] }
  });
});

test("recipient copy stays compact in English Ukrainian and Russian", () => {
  assert.deepEqual(checkoutRecipientCopy("en_US"), {
    recipient: "Recipient",
    self: "For me",
    other: "Someone else",
    choose: "Choose in Telegram",
    change: "Change",
    manual: "Enter @username",
    selected: "Selected recipient"
  });
  assert.equal(checkoutRecipientCopy("uk_UA").other, "Іншому");
  assert.equal(checkoutRecipientCopy("uk_UA").choose, "Обрати в Telegram");
  assert.equal(checkoutRecipientCopy("ru_RU").other, "Другому");
  assert.equal(checkoutRecipientCopy("ru_RU").choose, "Выбрать в Telegram");
});
