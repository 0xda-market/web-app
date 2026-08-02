import { mountAdminPrices } from "./admin-prices.js";
import { mountAdminProducts } from "./admin-products.js";

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

  const summary = adminWorkspaceSummary(catalog);
  const root = element(document, "section", { id: "admin-workspace", className: "admin-workspace" });
  const title = element(document, "h2", {}, "Administration");
  const description = element(
    document,
    "p",
    { className: "admin-workspace-description" },
    "Pre-wallet operations are introduced as isolated capabilities with independent server contracts."
  );
  const grid = element(document, "div", { className: "admin-capability-grid" });
  const productsWritable = supportsAdminProducts(transport);
  const pricesWritable = supportsAdminPrices(transport);
  const capabilities = [
    ["Products", `${summary.products} catalog products`, productsWritable ? "Catalog and localized copy are editable below." : "Catalog editing requires an administrator transport."],
    ["Prices", `${summary.pricedProducts} priced · ${summary.unpricedProducts} unpriced`, pricesWritable ? "Revisioned proposals and append-only history are available below." : "Price administration requires an administrator transport."],
    ["Users", "Roles and access", "User search and role changes will use internal user IDs."],
    ["Orders", "Quote and order lifecycle", "Order history and operations will preserve core lifecycle rules."],
    ["Listings", "Broker inventory", "Admin-wide listing visibility follows broker-owned listing contracts."],
    ["Fulfillment", "Manual operations", "Task claiming and completion are the final pre-wallet capability."]
  ];

  for (const [name, metric, note] of capabilities) {
    const card = element(document, "article", { className: "admin-capability" });
    card.append(
      element(document, "strong", {}, name),
      element(document, "span", { className: "admin-capability-metric" }, metric),
      element(document, "p", {}, note)
    );
    grid.append(card);
  }

  root.append(title, description, grid);
  container.append(root);
  const products = productsWritable
    ? mountAdminProducts({ document, session, transport, locale, container: root })
    : null;
  const prices = pricesWritable
    ? mountAdminPrices({ document, session, transport, locale, container: root })
    : null;
  const ready = Promise.all([
    products?.ready || Promise.resolve(null),
    prices?.ready || Promise.resolve(null)
  ]);
  return { root, summary, products, prices, ready };
}
