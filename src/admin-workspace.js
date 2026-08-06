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
  // The rail orients, it does not delay work: capabilities follow the same
  // operational order as the writable sections below, and a mounted capability
  // links straight into its own section.
  const capabilities = [
    {
      id: "prices",
      name: i18n.t("admin.prices"),
      metric: i18n.t("admin.pricesMetric", { priced: summary.pricedProducts, unpriced: summary.unpricedProducts }),
      note: i18n.t(pricesWritable ? "admin.pricesReady" : "admin.pricesUnavailable"),
      section: pricesWritable ? "admin-prices" : null
    },
    {
      id: "products",
      name: i18n.t("admin.products"),
      metric: i18n.t("admin.productsMetric", { count: summary.products }),
      note: i18n.t(productsWritable ? "admin.productsReady" : "admin.productsUnavailable"),
      section: productsWritable ? "admin-products" : null
    },
    { id: "users", name: i18n.t("admin.users"), metric: i18n.t("admin.usersMetric"), note: i18n.t("admin.usersNote") },
    { id: "orders", name: i18n.t("admin.orders"), metric: i18n.t("admin.ordersMetric"), note: i18n.t("admin.ordersNote") },
    { id: "listings", name: i18n.t("admin.listings"), metric: i18n.t("admin.listingsMetric"), note: i18n.t("admin.listingsNote") },
    {
      id: "fulfillment",
      name: i18n.t("admin.fulfillment"),
      metric: i18n.t("admin.fulfillmentMetric"),
      note: i18n.t("admin.fulfillmentNote")
    }
  ];

  for (const { id, name, metric, note, section = null } of capabilities) {
    const card = element(document, "article", {
      className: "admin-capability admin-capability-summary",
      role: "listitem",
      "data-admin-capability": id,
      "data-admin-capability-state": section ? "available" : "planned"
    });
    card.append(
      element(document, "span", { className: "admin-capability-name" }, name),
      element(document, "strong", { className: "admin-capability-metric" }, metric),
      element(document, "span", { className: "admin-capability-note" }, note)
    );
    if (section) {
      card.append(element(document, "a", {
        className: "admin-capability-link",
        href: `#${section}`,
        "data-admin-capability-link": id
      }, i18n.t("admin.open", { name })));
    }
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
