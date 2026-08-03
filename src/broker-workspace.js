import { createI18n } from "./i18n.js";

const LEGACY_STORAGE_PREFIX = "0xda-market.broker-offers.v2";

// Retained for hosts pinned to the previous draft-storage contract. Durable
// broker listings no longer read from or write to browser storage.
export function brokerStorageKey(session) {
  const subject = String(session?.subject || "").trim();
  const environment = String(session?.environment || "").trim();
  if (!subject) throw new TypeError("broker session subject is required");
  if (!environment) throw new TypeError("broker session environment is required");
  return `${LEGACY_STORAGE_PREFIX}:${encodeURIComponent(environment)}:${encodeURIComponent(subject)}`;
}

function element(document, tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "className") node.className = value;
    else if (key === "type") node.type = value;
    else node.setAttribute(key, value);
  }
  if (text !== null) node.textContent = text;
  return node;
}

function assertListingTransport(transport) {
  for (const method of ["listBrokerListings", "createBrokerListing", "updateBrokerListing", "withdrawBrokerListing"]) {
    if (typeof transport?.[method] !== "function") throw new TypeError(`transport.${method} must be a function`);
  }
}

function positiveDecimal(value, scale) {
  const text = String(value || "").trim();
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${scale}})?$`);
  return pattern.test(text) && /[1-9]/.test(text) ? text : null;
}

function normalizeListing(resource) {
  const attributes = resource?.attributes || {};
  const quantity = String(attributes.quantity || "");
  return Object.freeze({
    id: String(resource?.id || ""),
    sku: String(attributes.sku || ""),
    quantity,
    availableQuantity: String(attributes.available_quantity ?? quantity),
    reservedQuantity: String(attributes.reserved_quantity ?? "0"),
    soldQuantity: String(attributes.sold_quantity ?? "0"),
    priceAmount: String(attributes.price_amount || ""),
    currency: String(attributes.currency || ""),
    status: String(attributes.status || ""),
    version: Number(attributes.version),
    updatedAt: String(attributes.updated_at || "")
  });
}

export async function mountBrokerWorkspace({ document, catalog, session, currencies, transport, locale = "en_US" }) {
  if (!["broker", "admin"].includes(session?.role)) return null;
  if (!document?.createElement) throw new TypeError("document is required");
  if (!Array.isArray(catalog?.products)) throw new TypeError("broker catalog is required");
  if (!Array.isArray(currencies) || currencies.length === 0) throw new TypeError("broker currencies are required");
  assertListingTransport(transport);

  const i18n = createI18n(locale);
  const products = catalog.products;
  const root = element(document, "section", { id: "broker-workspace", className: "broker-workspace" });
  const title = element(document, "h2", {}, i18n.t("broker.title"));
  const description = element(document, "p", {}, i18n.t("broker.description"));
  const form = element(document, "form", { id: "broker-listing-form" });
  const product = element(document, "select", { name: "product", required: "required" });
  const quantity = element(document, "input", {
    name: "quantity", type: "number", min: "0.000000000001", step: "any", inputmode: "decimal", required: "required"
  });
  const amount = element(document, "input", {
    name: "amount", type: "number", min: "0.00000001", step: "any", inputmode: "decimal", required: "required"
  });
  const currency = element(document, "select", { name: "currency", required: "required" });
  const save = element(document, "button", { type: "submit" }, i18n.t("broker.publish"));
  const status = element(document, "p", { id: "broker-listing-status", role: "status" }, i18n.t("broker.loading"));
  const list = element(document, "div", { id: "broker-listing-list" });
  let editingId = null;
  let listings = [];

  for (const entry of products) {
    const option = element(document, "option");
    option.value = entry.id;
    option.textContent = entry?.attributes?.name || entry?.attributes?.button_label || entry.id;
    product.append(option);
  }
  for (const code of currencies) {
    const option = element(document, "option", { value: code }, code);
    currency.append(option);
  }
  quantity.value = "1";
  currency.value = currencies[0];

  function field(labelText, control) {
    const label = element(document, "label");
    label.append(element(document, "span", {}, labelText), control);
    return label;
  }

  function resetForm() {
    editingId = null;
    product.disabled = false;
    save.textContent = i18n.t("broker.publish");
    form.reset();
    quantity.value = "1";
    currency.value = currencies[0];
  }

  async function withdraw(listing) {
    status.textContent = i18n.t("broker.withdrawing");
    try {
      await transport.withdrawBrokerListing({ listingId: listing.id, version: listing.version });
      listings = listings.filter((entry) => entry.id !== listing.id);
      if (editingId === listing.id) resetForm();
      render();
      status.textContent = i18n.t("broker.withdrawn");
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function render() {
    list.replaceChildren();
    if (!listings.length) {
      list.append(element(document, "p", {}, i18n.t("broker.empty")));
      return;
    }
    for (const listing of listings) {
      const productEntry = products.find((entry) => entry.id === listing.sku);
      const card = element(document, "article", { className: "broker-listing" });
      card.append(
        element(document, "strong", {}, productEntry?.attributes?.name || listing.sku),
        element(document, "span", {}, `${listing.quantity} × ${listing.priceAmount} ${listing.currency}`),
        element(document, "small", { className: "broker-listing-inventory" }, i18n.t("broker.inventory", {
          available: listing.availableQuantity,
          reserved: listing.reservedQuantity,
          sold: listing.soldQuantity
        }))
      );
      const edit = element(document, "button", { type: "button" }, i18n.t("broker.edit"));
      edit.addEventListener("click", () => {
        editingId = listing.id;
        product.value = listing.sku;
        product.disabled = true;
        quantity.value = listing.quantity;
        amount.value = listing.priceAmount;
        currency.value = listing.currency;
        save.textContent = i18n.t("broker.update");
        status.textContent = i18n.t("broker.editing");
      });
      const remove = element(document, "button", { type: "button" }, i18n.t("broker.withdraw"));
      remove.addEventListener("click", () => withdraw(listing));
      card.append(edit, remove);
      list.append(card);
    }
  }

  form.append(
    field(i18n.t("broker.asset"), product),
    field(i18n.t("broker.quantity"), quantity),
    field(i18n.t("broker.unitPrice"), amount),
    field(i18n.t("broker.currency"), currency),
    save
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalizedQuantity = positiveDecimal(quantity.value, 12);
    const normalizedAmount = positiveDecimal(amount.value, 8);
    if (!product.value || !normalizedQuantity || !normalizedAmount || !currencies.includes(currency.value)) {
      status.textContent = i18n.t("broker.invalid");
      return;
    }

    save.disabled = true;
    status.textContent = editingId ? i18n.t("broker.updating") : i18n.t("broker.publishing");
    try {
      let resource;
      if (editingId) {
        const current = listings.find((entry) => entry.id === editingId);
        resource = await transport.updateBrokerListing({
          listingId: editingId,
          quantity: normalizedQuantity,
          priceAmount: normalizedAmount,
          currency: currency.value,
          version: current.version
        });
      } else {
        resource = await transport.createBrokerListing({
          sku: product.value,
          quantity: normalizedQuantity,
          priceAmount: normalizedAmount,
          currency: currency.value
        });
      }
      const listing = normalizeListing(resource);
      const index = listings.findIndex((entry) => entry.id === listing.id);
      if (index >= 0) listings[index] = listing;
      else listings.unshift(listing);
      product.disabled = false;
      resetForm();
      render();
      status.textContent = index >= 0 ? i18n.t("broker.updated") : i18n.t("broker.published");
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });

  root.append(title, description, form, status, list);
  (document.querySelector("main") || document.body).append(root);
  try {
    const resources = await transport.listBrokerListings();
    if (!Array.isArray(resources)) throw new TypeError("broker listings response must be an array");
    listings = resources.map(normalizeListing);
    render();
    status.textContent = i18n.t("broker.active", { count: listings.length });
  } catch (error) {
    render();
    status.textContent = error.message;
  }

  return { root, form, list, status, getListings: () => [...listings] };
}
