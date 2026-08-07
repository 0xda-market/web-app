import test from "node:test";
import assert from "node:assert/strict";
import { createI18n, localeSupport, normalizeLocale } from "../src/i18n.js";
import { createMarketApp } from "../src/index.js";
import { bootstrapDocument, marketDocument } from "./helpers.js";

test("normalizes full locales and falls back unknown languages to English", () => {
  assert.equal(normalizeLocale("uk"), "uk_UA");
  assert.equal(normalizeLocale("uk-UA"), "uk_UA");
  assert.equal(normalizeLocale("ru-KZ"), "ru_RU");
  assert.equal(normalizeLocale("es-MX"), "es_ES");
  assert.equal(normalizeLocale("pt-BR"), "pt_BR");
  assert.equal(normalizeLocale("en-IN"), "en_US");
  assert.equal(normalizeLocale("en-NG"), "en_US");
  assert.equal(normalizeLocale("ja-JP"), "en_US");
});

test("exposes european locale skeletons aligned with supported pricing currencies", () => {
  assert.deepEqual(localeSupport("de-DE"), { locale: "de_DE", level: "skeleton", fallback: "en_US", currency: "EUR" });
  assert.deepEqual(localeSupport("fr-CH"), { locale: "fr_CH", level: "skeleton", fallback: "en_US", currency: "CHF" });
  assert.deepEqual(localeSupport("pl-PL"), { locale: "pl_PL", level: "skeleton", fallback: "en_US", currency: "PLN" });
  assert.deepEqual(localeSupport("cs-CZ"), { locale: "cs_CZ", level: "skeleton", fallback: "en_US", currency: "CZK" });
  assert.deepEqual(localeSupport("hu-HU"), { locale: "hu_HU", level: "skeleton", fallback: "en_US", currency: "HUF" });
});

test("ships complete primary market copy in Russian, Spanish and Brazilian Portuguese", () => {
  const ru = createI18n("ru-KZ");
  const es = createI18n("es-MX");
  const pt = createI18n("pt-BR");

  assert.equal(localeSupport(ru.locale).level, "full");
  assert.equal(localeSupport(es.locale).level, "full");
  assert.equal(localeSupport(pt.locale).level, "full");
  assert.equal(ru.t("checkout.confirm"), "Подтвердить покупку");
  assert.equal(ru.t("admin.title"), "Администрирование");
  assert.equal(es.t("checkout.confirm"), "Confirmar compra");
  assert.equal(es.t("broker.routing.best"), "Mejor oferta");
  assert.equal(pt.t("checkout.confirm"), "Confirmar compra");
  assert.equal(pt.t("products.localizationsTitle"), "Localizações");
});

test("european skeletons preserve locale identity while copy falls back to English", () => {
  const de = createI18n("de-DE");
  assert.equal(de.locale, "de_DE");
  assert.equal(de.t("search.placeholder"), "Search");
  assert.equal(de.category("crypto_asset"), "Crypto assets");
});

test("translates category identifiers without changing their stable IDs", () => {
  const uk = createI18n("uk");
  const ru = createI18n("ru-KZ");
  const es = createI18n("es-MX");
  const pt = createI18n("pt-BR");
  assert.equal(uk.category("telegram_premium"), "Telegram Premium");
  assert.equal(uk.category("crypto_asset"), "Криптоактиви");
  assert.equal(ru.category("crypto_asset"), "Криптоактивы");
  assert.equal(es.category("crypto_asset"), "Criptoactivos");
  assert.equal(pt.category("crypto_asset"), "Criptoativos");
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
