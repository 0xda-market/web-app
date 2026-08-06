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

test("loads a revisioned proposal and atomically applies only changed prices", async () => {
  const calls = [];
  let revision = 4;
  const transport = {
    async getAdminPriceProposal() { return proposal(revision); },
    async listAdminPriceHistory() { return history(revision); },
    async applyAdminPrices(payload) {
      calls.push(payload);
      revision += payload.prices.length;
      return { status: "ok", data: [], meta: { revision } };
    }
  };
  const controller = createAdminPricingController({ transport, locale: "en_US" });
  await controller.load();
  controller.setPrice("premium_3m", "12.75");
  await controller.apply();

  assert.deepEqual(calls, [{
    revision: 4,
    prices: [{ sku: "premium_3m", amount_usdt: "12.75" }]
  }]);
  assert.equal(controller.state().revision, 5);
});

test("rejects an empty or invalid changed-price application", async () => {
  const transport = {
    async getAdminPriceProposal() { return proposal(); },
    async listAdminPriceHistory() { return history(); },
    async applyAdminPrices() { throw new Error("must not apply"); }
  };
  const controller = createAdminPricingController({ transport });
  await controller.load();
  assert.throws(() => controller.application(), /change at least one price/);
  controller.setPrice("uah", "");
  assert.throws(() => controller.application(), /every price must be a positive decimal/);
});

test("mounts the price workspace only for administrators", async () => {
  const document = marketDocument();
  const calls = [];
  const transport = {
    async getAdminPriceProposal() { return proposal(); },
    async listAdminPriceHistory() { return history(); },
    async applyAdminPrices(payload) {
      calls.push(payload);
      return { status: "ok", data: [], meta: { revision: 5 } };
    }
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

  const [firstRow] = mounted.rows.children;
  const [name, amounts, firstInput, indicator] = firstRow.children;
  assert.equal(name.className, "admin-price-name");
  assert.equal(amounts.children[0].attributes["data-price-amount"], "current");
  assert.equal(amounts.children[0].children[1].textContent, "12.5");
  assert.equal(amounts.children[1].attributes["data-price-amount"], "previous");
  assert.equal(amounts.children[1].children[1].textContent, "12.1");
  assert.equal(firstRow.attributes["data-price-state"], "unchanged");
  assert.equal(indicator.textContent, "Unchanged");
  assert.equal(mounted.applyButton.disabled, true);
  assert.equal(firstInput.type, "number");
  assert.equal(firstInput.attributes.inputmode, "decimal");
  assert.equal(firstInput.attributes.min, "0.000001");
  assert.equal(firstInput.attributes.step, "any");
  firstInput.value = "12.75";
  firstInput.dispatch("input");
  assert.equal(firstRow.attributes["data-price-state"], "changed");
  assert.equal(indicator.textContent, "Changed");
  assert.equal(mounted.form.attributes["data-changed-prices"], "1");
  assert.equal(mounted.applyButton.disabled, false);
  assert.match(mounted.applyButton.textContent, /\(1\)/);

  firstInput.value = "12.5";
  firstInput.dispatch("input");
  assert.equal(firstRow.attributes["data-price-state"], "unchanged");
  assert.equal(mounted.applyButton.disabled, true);
  firstInput.value = "12.75";
  firstInput.dispatch("input");

  await mounted.form.dispatch("submit");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].prices, [{ sku: "premium_3m", amount_usdt: "12.75" }]);
  assert.match(mounted.status.textContent, /applied atomically/i);
  assert.equal(mounted.root.inert, false);
  assert.equal(mounted.root.attributes["aria-busy"], "false");
});

test("makes the complete price section pending until its POST resolves", async () => {
  const document = marketDocument();
  let resolveApply;
  const transport = {
    async getAdminPriceProposal() { return proposal(); },
    async listAdminPriceHistory() { return history(); },
    async applyAdminPrices() {
      return new Promise((resolve) => { resolveApply = resolve; });
    }
  };
  const mounted = mountAdminPrices({
    document,
    session: { role: "admin" },
    transport
  });
  await mounted.ready;
  const firstInput = mounted.rows.children[0].children[2];
  firstInput.value = "12.75";
  firstInput.dispatch("input");

  const submission = mounted.form.dispatch("submit");
  await Promise.resolve();
  assert.equal(mounted.root.inert, true);
  assert.equal(mounted.root.attributes["aria-busy"], "true");
  assert.match(mounted.status.textContent, /Applying prices/);

  resolveApply({ status: "ok", data: [], meta: { revision: 5 } });
  await submission;
  assert.equal(mounted.root.inert, false);
  assert.equal(mounted.root.attributes["aria-busy"], "false");
});
