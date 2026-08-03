import test from "node:test";
import assert from "node:assert/strict";
import { CatalogStore, CheckoutController, createCatalogSnapshot, pageSizeForViewport } from "../src/engine.js";
import { bootstrapDocument } from "./helpers.js";

test("paginates the complete snapshot entirely in memory", () => {
  const snapshot = createCatalogSnapshot(bootstrapDocument({ count: 1488 }));
  const store = new CatalogStore(snapshot, { pageSize: 6 });
  assert.equal(store.view().pageCount, 248);
  assert.equal(store.next().products[0].id, "product_7");
  assert.equal(snapshot.products.length, 1488);
});

test("applies portrait and landscape page-size policy", () => {
  assert.equal(pageSizeForViewport({ width: 390, height: 844 }), 6);
  assert.equal(pageSizeForViewport({ width: 800, height: 390 }), 12);
  assert.equal(pageSizeForViewport({ width: 1024, height: 600 }), 18);
});

test("executes quantity-aware checkout only after explicit actions", async () => {
  const calls = [];
  const controller = new CheckoutController({
    async quote(id, quantity) {
      calls.push(["quote", id, quantity]);
      return {
        id: "quote-1",
        attributes: {
          expires_at: "2026-08-01T13:00:00Z",
          quantity,
          total_price_usdt: "25",
          currency: "USDT"
        }
      };
    },
    async accept(id) { calls.push(["accept", id]); return { id: "order-1", attributes: { status: "pending" } }; },
    async refresh(id) { calls.push(["refresh", id]); return { id, attributes: { status: "succeeded" } }; }
  });
  const product = createCatalogSnapshot(bootstrapDocument({ count: 1 })).products[0];
  await controller.quote(product, "2");
  assert.equal(controller.state.quantity, "2");
  await controller.accept();
  assert.equal(controller.state.quantity, "2");
  await controller.refresh();
  assert.deepEqual(calls, [["quote", "product_1", "2"], ["accept", "quote-1"], ["refresh", "order-1"]]);
});

test("rejects invalid purchase quantities before transport", async () => {
  const controller = new CheckoutController({
    async quote() { throw new Error("must not call"); },
    async accept() {},
    async refresh() {}
  });
  const product = createCatalogSnapshot(bootstrapDocument({ count: 1 })).products[0];

  await assert.rejects(() => controller.quote(product, "0"), /positive decimal/);
  await assert.rejects(() => controller.quote(product, "0.0000000000001"), /12 fractional digits/);
});
