import test from "node:test";
import assert from "node:assert/strict";
import { mountAdminWorkspace } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("admin overview is a compact semantic rail before writable sections", () => {
  const document = marketDocument();
  const workspace = mountAdminWorkspace({
    document,
    catalog: { products: bootstrapDocument({ role: "admin" }).data },
    session: { role: "admin" },
    locale: "uk_UA",
    transport: {}
  });

  const [title, description, rail] = workspace.root.children;
  assert.equal(title.textContent, "Адміністрування");
  assert.equal(description.className, "admin-workspace-description");
  assert.equal(rail.attributes.role, "list");
  assert.match(rail.className, /admin-capability-rail/);
  assert.equal(rail.children.length, 6);
  assert.equal(rail.children[0].attributes.role, "listitem");
  assert.deepEqual(
    rail.children.map((card) => card.attributes["data-admin-capability"]),
    ["prices", "products", "users", "orders", "listings", "fulfillment"]
  );
  assert.equal(rail.children[0].children[0].className, "admin-capability-name");
  assert.equal(rail.children[0].children[1].className, "admin-capability-metric");
  assert.equal(rail.children[0].children[2].className, "admin-capability-note");
  assert.equal(rail.children[0].attributes["data-admin-capability-state"], "planned");
  assert.equal(rail.children[0].children.length, 3);
});

test("a mounted capability links from the rail into its own working section", async () => {
  const document = marketDocument();
  const workspace = mountAdminWorkspace({
    document,
    catalog: { products: bootstrapDocument({ role: "admin" }).data },
    session: { role: "admin" },
    transport: {
      async listAdminProducts() { return []; },
      async updateAdminProduct() { return {}; },
      async saveAdminProductLocalization() { return {}; },
      async getAdminPriceProposal() { return { data: [], meta: { revision: 1 } }; },
      async listAdminPriceHistory() { return { data: [], meta: { revision: 1 } }; },
      async applyAdminPrices() { return { status: "ok", data: [], meta: { revision: 2 } }; }
    }
  });

  await workspace.ready;
  const [prices, products, users] = workspace.root.children[2].children;
  assert.equal(prices.attributes["data-admin-capability-state"], "available");
  assert.equal(prices.children[3].attributes.href, "#admin-prices");
  assert.equal(prices.children[3].textContent, "Open Prices");
  assert.equal(products.children[3].attributes.href, "#admin-products");
  assert.equal(users.attributes["data-admin-capability-state"], "planned");
  assert.equal(users.children.length, 3);
});
