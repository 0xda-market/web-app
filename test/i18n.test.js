import test from "node:test";
import assert from "node:assert/strict";
import { createI18n, normalizeLocale } from "../src/i18n.js";
import { createMarketApp } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("normalizes Ukrainian locales and falls back to English", () => {
  assert.equal(normalizeLocale("uk"), "uk_UA");
  assert.equal(normalizeLocale("uk-UA"), "uk_UA");
  assert.equal(normalizeLocale("fr-FR"), "en_US");
});

test("translates category identifiers without changing their stable IDs", () => {
  const uk = createI18n("uk");
  assert.equal(uk.category("telegram_premium"), "Telegram Premium");
  assert.equal(uk.category("telegram_stars"), "Telegram Stars");
  assert.equal(uk.category("crypto_asset"), "Криптоактиви");
  assert.equal(uk.category("unknown_category", "Нова категорія"), "Нова категорія");
});

test("mounts the Ukrainian market shell and catalog copy", async () => {
  const document = marketDocument();
  const bootstrap = bootstrapDocument({ role: "client", count: 2 });
  bootstrap.data[0].attributes.metadata.category = "telegram_premium";
  bootstrap.data[0].attributes.price = null;
  bootstrap.data[1].attributes.metadata.category = "crypto_asset";
  const host = {
    locale: () => "uk",
    viewport: () => ({ width: 390, height: 844 }),
    onViewportChanged: () => {},
    selectionFeedback: () => {}
  };
  const transport = {
    bootstrap: async ({ locale }) => {
      assert.equal(locale, "uk_UA");
      return bootstrap;
    },
    quote: async () => ({}),
    acceptQuote: async () => ({}),
    refreshOrder: async () => ({})
  };

  const app = createMarketApp({ host, transport, document });
  await app.start();

  assert.equal(app.context().locale, "uk_UA");
  assert.equal(document.elements.search.placeholder, "Пошук");
  assert.equal(document.elements.home.textContent, "Категорії");
  assert.equal(document.elements.status.textContent, "2 товари · 1/1");
  assert.deepEqual(
    document.elements.category.children.map((option) => option.textContent),
    ["Усі", "Telegram Premium", "Криптоактиви"]
  );
  assert.equal(document.elements.products.children[0].children[0].textContent, "Telegram Premium");
  assert.equal(document.elements.products.children[0].children[2].textContent, "Недоступно");
});

test("keeps English as the default UI contract", () => {
  const en = createI18n("en_US");
  assert.equal(en.t("search.placeholder"), "Search");
  assert.equal(en.t("catalog.summary", { count: 9, page: 1, pageCount: 2 }), "9 products · 1/2");
});
