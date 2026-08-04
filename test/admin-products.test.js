import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminCatalogController,
  createAdminProductController,
  mountAdminWorkspace
} from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

function localization(locale, version = 0, sku = "premium_3m") {
  return {
    type: "product_localization",
    id: `${sku}:${locale}`,
    attributes: {
      product_sku: sku,
      locale,
      full_name: locale === "uk_UA" ? "Telegram Premium на 3 місяці" : "Telegram Premium 3 months",
      button_label: locale === "uk_UA" ? "Premium · 3 міс." : "Premium · 3m",
      version
    }
  };
}

function product({
  id = "premium_3m",
  version = 2,
  status = "active",
  localizations = [localization("en_US", 0, id)]
} = {}) {
  return {
    type: "product",
    id,
    attributes: {
      short_name: id === "premium_3m" ? "Premium · 3m" : "Premium · 12m",
      status,
      position: id === "premium_3m" ? 1 : 3,
      marketable: true,
      metadata: { family: "telegram_premium", duration_months: id === "premium_3m" ? 3 : 12 },
      version,
      localizations
    }
  };
}

test("admin catalog controller keeps product and localization versions independent", async () => {
  const calls = [];
  const controller = createAdminCatalogController({
    locale: "en_US",
    transport: {
      async listAdminProducts({ locale }) {
        calls.push(["list", locale]);
        return [product()];
      },
      async updateAdminProduct(input) {
        calls.push(["update", input]);
        return product({ version: 3 });
      },
      async saveAdminProductLocalization(input) {
        calls.push(["localization", input]);
        return localization(input.locale, (input.version ?? -1) + 1);
      }
    }
  });

  await controller.load();
  assert.equal(controller.state().selected.id, "premium_3m");
  await controller.updateProduct({ short_name: "Premium quarter" });
  assert.equal(calls[1][1].version, 2);
  assert.equal(controller.state().selected.version, 3);

  await controller.saveLocalization({
    locale: "en-US",
    fullName: "Telegram Premium 3 months",
    buttonLabel: "Premium 3m"
  });
  assert.equal(calls[2][1].locale, "en_US");
  assert.equal(calls[2][1].version, 0);

  await controller.saveLocalization({
    locale: "uk_UA",
    fullName: "Telegram Premium на 3 місяці",
    buttonLabel: "Premium · 3 міс."
  });
  assert.equal("version" in calls[3][1], false);
  assert.deepEqual(controller.state().selected.localizations.map((entry) => entry.locale), ["en_US", "uk_UA"]);
});

test("product creation always submits an inactive product with its initial localization", async () => {
  const calls = [];
  const controller = createAdminProductController({
    transport: {
      async createAdminProduct(payload) {
        calls.push(payload);
        return product({ id: payload.sku, status: "inactive", version: 0 });
      }
    }
  });

  const created = await controller.create({
    sku: "premium_12m",
    shortName: "Premium · 12m",
    position: 3,
    marketable: true,
    metadata: { family: "telegram_premium", duration_months: 12 },
    locale: "uk-UA",
    fullName: "Telegram Premium на 12 місяців",
    buttonLabel: "Premium · 12 міс."
  });

  assert.equal(created.id, "premium_12m");
  assert.deepEqual(calls, [{
    sku: "premium_12m",
    attributes: {
      short_name: "Premium · 12m",
      status: "inactive",
      position: 3,
      marketable: true,
      metadata: { family: "telegram_premium", duration_months: 12 }
    },
    localization: {
      locale: "uk_UA",
      fullName: "Telegram Premium на 12 місяців",
      buttonLabel: "Premium · 12 міс."
    }
  }]);
});

test("admin workspace mounts product creation and refreshes the editor to the new inactive SKU", async () => {
  const document = marketDocument();
  const catalog = { products: bootstrapDocument({ role: "admin" }).data };
  let products = [product()];
  const workspace = mountAdminWorkspace({
    document,
    catalog,
    session: { role: "admin" },
    locale: "uk_UA",
    transport: {
      async listAdminProducts() { return products; },
      async updateAdminProduct() { return product({ version: 3 }); },
      async saveAdminProductLocalization() { return localization("en_US", 1); },
      async createAdminProduct(payload) {
        const created = product({
          id: payload.sku,
          status: "inactive",
          version: 0,
          localizations: [localization(payload.localization.locale, 0, payload.sku)]
        });
        products = [...products, created];
        return created;
      }
    }
  });

  await workspace.ready;
  assert.ok(workspace.products);
  assert.ok(workspace.createProduct);
  assert.equal(workspace.products.root.attributes.id, "admin-products");
  assert.equal(workspace.createProduct.root.attributes.id, "admin-create-product");
  assert.equal(workspace.products.controller.state().products.length, 1);

  const controls = workspace.createProduct.form.children.map((label) => label.children?.[1]).filter(Boolean);
  const [sku, shortName, position, marketable, metadata, locale, fullName, buttonLabel] = controls;
  sku.value = "premium_12m";
  shortName.value = "Premium · 12m";
  position.value = "3";
  marketable.checked = true;
  metadata.value = JSON.stringify({ family: "telegram_premium", duration_months: 12 });
  locale.value = "uk_UA";
  fullName.value = "Telegram Premium на 12 місяців";
  buttonLabel.value = "Premium · 12 міс.";
  await workspace.createProduct.form.dispatch("submit");

  assert.equal(workspace.products.controller.state().products.length, 2);
  assert.equal(workspace.products.controller.state().selected.id, "premium_12m");
  assert.equal(workspace.products.controller.state().selected.status, "inactive");

  assert.equal(mountAdminWorkspace({
    document,
    catalog,
    session: { role: "broker" },
    transport: {}
  }), null);
});

test("orders prices third and keeps localizations after the pricing section", async () => {
  const document = marketDocument();
  const workspace = mountAdminWorkspace({
    document,
    catalog: { products: bootstrapDocument({ role: "admin" }).data },
    session: { role: "admin" },
    transport: {
      async listAdminProducts() { return [product()]; },
      async updateAdminProduct() { return product({ version: 3 }); },
      async saveAdminProductLocalization() { return localization("en_US", 1); },
      async createAdminProduct(payload) { return product({ id: payload.sku, status: "inactive", version: 0 }); },
      async getAdminPriceProposal() {
        return {
          data: [{
            type: "price_proposal",
            id: "premium_3m",
            attributes: { name: "Premium 3m", position: 1, current_amount_usdt: "12.5" }
          }],
          meta: { revision: 1 }
        };
      },
      async listAdminPriceHistory() { return { data: [], meta: { revision: 1 } }; },
      async applyAdminPrices() { return { status: "ok", data: [], meta: { revision: 2 } }; }
    }
  });

  await workspace.ready;
  const sectionIds = workspace.root.children
    .map((child) => child.attributes?.id)
    .filter(Boolean);
  assert.deepEqual(sectionIds, [
    "admin-products",
    "admin-create-product",
    "admin-prices",
    "admin-localizations"
  ]);
  assert.equal(workspace.products.localizationRoot, workspace.root.children.at(-1));
});

test("makes product creation pending until its POST resolves", async () => {
  const document = marketDocument();
  let resolveCreate;
  let products = [product()];
  const workspace = mountAdminWorkspace({
    document,
    catalog: { products: bootstrapDocument({ role: "admin" }).data },
    session: { role: "admin" },
    transport: {
      async listAdminProducts() { return products; },
      async updateAdminProduct() { return product({ version: 3 }); },
      async saveAdminProductLocalization() { return localization("en_US", 1); },
      async createAdminProduct(payload) {
        return new Promise((resolve) => {
          resolveCreate = () => {
            const created = product({ id: payload.sku, status: "inactive", version: 0 });
            products = [...products, created];
            resolve(created);
          };
        });
      }
    }
  });
  await workspace.ready;
  const controls = workspace.createProduct.form.children.map((label) => label.children?.[1]).filter(Boolean);
  const [sku, shortName, position, marketable, metadata, locale, fullName, buttonLabel] = controls;
  sku.value = "premium_12m";
  shortName.value = "Premium · 12m";
  position.value = "3";
  marketable.checked = true;
  metadata.value = "{}";
  locale.value = "uk_UA";
  fullName.value = "Telegram Premium на 12 місяців";
  buttonLabel.value = "Premium · 12 міс.";

  const submission = workspace.createProduct.form.dispatch("submit");
  await Promise.resolve();
  assert.equal(workspace.createProduct.root.inert, true);
  assert.equal(workspace.createProduct.root.attributes["aria-busy"], "true");
  resolveCreate();
  await submission;
  assert.equal(workspace.createProduct.root.inert, false);
  assert.equal(workspace.createProduct.root.attributes["aria-busy"], "false");
});
