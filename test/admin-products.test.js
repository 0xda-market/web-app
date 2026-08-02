import test from "node:test";
import assert from "node:assert/strict";
import { createAdminCatalogController, mountAdminWorkspace } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

function localization(locale, version = 0) {
  return {
    type: "product_localization",
    id: `premium_3m:${locale}`,
    attributes: {
      product_sku: "premium_3m",
      locale,
      full_name: locale === "uk_UA" ? "Telegram Premium на 3 місяці" : "Telegram Premium 3 months",
      button_label: locale === "uk_UA" ? "Premium · 3 міс." : "Premium · 3m",
      version
    }
  };
}

function product({ version = 2, localizations = [localization("en_US")] } = {}) {
  return {
    type: "product",
    id: "premium_3m",
    attributes: {
      short_name: "Premium · 3m",
      status: "active",
      position: 1,
      marketable: true,
      metadata: { family: "telegram_premium", duration_months: 3 },
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

test("admin workspace mounts the writable products surface only with an admin transport", async () => {
  const document = marketDocument();
  const catalog = { products: bootstrapDocument({ role: "admin" }).data };
  const workspace = mountAdminWorkspace({
    document,
    catalog,
    session: { role: "admin" },
    transport: {
      async listAdminProducts() { return [product()]; },
      async updateAdminProduct() { return product({ version: 3 }); },
      async saveAdminProductLocalization() { return localization("en_US", 1); }
    }
  });

  await workspace.ready;
  assert.ok(workspace.products);
  assert.equal(workspace.products.root.attributes.id, "admin-products");
  assert.equal(workspace.products.controller.state().products.length, 1);
  assert.equal(workspace.root.children.at(-1), workspace.products.root);

  assert.equal(mountAdminWorkspace({
    document,
    catalog,
    session: { role: "broker" },
    transport: {}
  }), null);
});
