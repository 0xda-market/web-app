import test from "node:test";
import assert from "node:assert/strict";
import { createAdminPricingController, mountAdminPrices } from "../src/index.js";
import { marketDocument } from "./helpers.js";

function proposal(revision = 4) {
  return {
    data: [
      {
        type: "price_proposal",
        id: "premium_3m",
        attributes: {
          name: "Telegram Premium 3 months",
          position: 1,
          current_amount_usdt: "12.5",
          previous_amount_usdt: "12.1",
          current_applied_at: "2026-08-02T12:00:00Z"
        }
      },
      {
        type: "price_proposal",
        id: "uah",
        attributes: {
          name: "Ukrainian hryvnia",
          position: 20,
          current_amount_usdt: "0.024",
          previous_amount_usdt: "0.023"
        }
      }
    ],
    meta: { revision, generated_at: "2026-08-02T13:00:00Z" }
  };
}

function history(revision = 4) {
  return {
    data: [
      {
        type: "price_history",
        id: "4",
        attributes: {
          sku: "premium_3m",
          amount_usdt: "12.5",
          source: "admin",
          edited_by_user_id: "admin-1",
          applied_at: "2026-08-02T12:00:00Z"
        }
      }
    ],
    meta: { revision }
  };
}

test("loads a revisioned proposal and applies the complete price set", async () => {
  const calls = [];
  let revision = 4;
  const transport = {
    async getAdminPriceProposal() { return proposal(revision); },
    async listAdminPriceHistory() { return history(revision); },
    async applyAdminPrices(payload) {
      calls.push(payload);
      revision += payload.prices.length;
      return { data: [], meta: { revision } };
    }
  };
  const controller = createAdminPricingController({ transport, locale: "en_US" });
  await controller.load();
  controller.setPrice("premium_3m", "12.75");
  await controller.apply();

  assert.deepEqual(calls, [{
    revision: 4,
    prices: [
      { sku: "premium_3m", amount_usdt: "12.75" },
      { sku: "uah", amount_usdt: "0.024" }
    ]
  }]);
  assert.equal(controller.state().revision, 6);
});

test("rejects an incomplete or invalid catalog-wide application", async () => {
  const transport = {
    async getAdminPriceProposal() { return proposal(); },
    async listAdminPriceHistory() { return history(); },
    async applyAdminPrices() { throw new Error("must not apply"); }
  };
  const controller = createAdminPricingController({ transport });
  await controller.load();
  controller.setPrice("uah", "");
  assert.throws(() => controller.application(), /every price must be a positive decimal/);
});

test("mounts the price workspace only for administrators", async () => {
  const document = marketDocument();
  const transport = {
    async getAdminPriceProposal() { return proposal(); },
    async listAdminPriceHistory() { return history(); },
    async applyAdminPrices() { return { data: [], meta: { revision: 6 } }; }
  };
  assert.equal(mountAdminPrices({
    document,
    session: { role: "broker" },
    transport
  }), null);

  const mounted = mountAdminPrices({
    document,
    session: { role: "admin" },
    transport
  });
  await mounted.ready;
  assert.equal(mounted.rows.children.length, 2);
  assert.match(mounted.status.textContent, /revision 4/);

  await mounted.form.dispatch("submit");
  assert.match(mounted.applyButton.textContent, /Confirm 2 prices/);
});
