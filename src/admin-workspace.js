import { mountAdminCreateProduct } from "./admin-create-product.js";
import { mountAdminPrices } from "./admin-prices.js";
import { mountAdminProducts } from "./admin-products.js";
import { createI18n } from "./i18n.js";

function element(document, tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

function supportsAdminProducts(transport) {
  return ["listAdminProducts", "updateAdminProduct", "saveAdminProductLocalization"]
    .every((method) => typeof transport?.[method] === "function");
}

function supportsAdminProductCreation(transport) {
  return typeof transport?.createAdminProduct === "function";
}

function supportsAdminPrices(transport) {
  return ["getAdminPriceProposal", "applyAdminPrices", "listAdminPriceHistory"]
    .every((method) => typeof transport?.[method] === "function");
}

export function adminWorkspaceSummary(catalog) {
  const products = Array.isArray(catalog?.products) ? catalog.products : [];
  const priced = products.filter((entry) => entry?.attributes?.price).length;
  return Object.freeze({
    products: products.length,
    pricedProducts: priced,
    unpricedProducts: products.length - priced
  });
}

export function mountAdminWorkspace({
  document,
  catalog,
  session,
  transport = null,
  locale = "en_US",
  container = document?.body
}) {
  if (session?.role !== "admin") return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!Array.isArray(catalog?.products)) throw new TypeError("admin catalog is required");
  if (!container?.append) throw new TypeError("admin workspace container is required");

  const i18n = createI18n(locale);
  const summary = adminWorkspaceSummary(catalog);
  const root = element(document, "section", { id: "admin-workspace", className: "admin-workspace" });
  const title = element(document, "h2", {}, i18n.t("admin.title"));
  const description = element(
    document,
    "p",
    { className: "admin-workspace-description" },
    i18n.t("admin.description")
  );
  const grid = element(document, "div", {
    className: "admin-capability-grid admin-capability-rail",
    role: "list",
    "aria-label": i18n.t("admin.title")
  });
  const productsWritable = supportsAdminProducts(transport);
  const productsCreatable = supportsAdminProductCreation(transport);
  const pricesWritable = supportsAdminPrices(transport);
  const capabilities = [
    [
      "products",
      i18n.t("admin.products"),
      i18n.t("admin.productsMetric", { count: summary.products }),
      i18n.t(productsWritable ? "admin.productsReady" : "admin.productsUnavailable")
    ],
    [
      "prices",
      i18n.t("admin.prices"),
      i18n.t("admin.pricesMetric", { priced: summary.pricedProducts, unpriced: summary.unpricedProducts }),
      i18n.t(pricesWritable ? "admin.pricesReady" : "admin.pricesUnavailable")
    ],
    ["users", i18n.t("admin.users"), i18n.t("admin.usersMetric"), i18n.t("admin.usersNote")],
    ["orders", i18n.t("admin.orders"), i18n.t("admin.ordersMetric"), i18n.t("admin.ordersNote")],
    ["listings", i18n.t("admin.listings"), i18n.t("admin.listingsMetric"), i18n.t("admin.listingsNote")],
    ["fulfillment", i18n.t("admin.fulfillment"), i18n.t("admin.fulfillmentMetric"), i18n.t("admin.fulfillmentNote")]
  ];

  for (const [id, name, metric, note] of capabilities) {
    const card = element(document, "article", {
      className: "admin-capability admin-capability-summary",
      role: "listitem",
      "data-admin-capability": id
    });
    card.append(
      element(document, "span", { className: "admin-capability-name" }, name),
      element(document, "strong", { className: "admin-capability-metric" }, metric),
      element(document, "span", { className: "admin-capability-note" }, note)
    );
    grid.append(card);
  }

  root.append(title, description, grid);
  container.append(root);
  const prices = pricesWritable
    ? mountAdminPrices({ document, session, transport, locale: i18n.locale, container: root })
    : null;
  const products = productsWritable
    ? mountAdminProducts({
      document,
      session,
      transport,
      locale: i18n.locale,
      container: root,
      localizationContainer: null
    })
    : null;
  const createProduct = productsCreatable
    ? mountAdminCreateProduct({
      document,
      session,
      transport,
      locale: i18n.locale,
      container: root,
      onCreated: (resource) => products?.reload(resource?.id)
    })
    : null;
  if (products?.localizationRoot) root.append(products.localizationRoot);
  const ready = Promise.all([
    products?.ready || Promise.resolve(null),
    prices?.ready || Promise.resolve(null)
  ]);
  return { root, summary, products, createProduct, prices, ready };
}
